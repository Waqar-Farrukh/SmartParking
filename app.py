# Final Deployment Check
import pyodbc
import hashlib
import time
import csv
import io
import math
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for all origins and methods to allow frontend-backend communication
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- DATABASE CONFIG ---
SERVER = r'DESKTOP-UQHOTMT\SQLEXPRESS'
DATABASE = 'SmartParkingDB'
CONN_STR = f'Driver={{ODBC Driver 17 for SQL Server}};Server={SERVER};Database={DATABASE};Trusted_Connection=yes;'

def get_db():
    """Create a fresh connection per request to avoid 'Connection is busy' errors."""
    return pyodbc.connect(CONN_STR, autocommit=True)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest().upper()

OVERSTAY_GRACE_MINUTES = 10

def parse_db_time(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace('Z', '').split('+')[0])
    return value

def overstay_fine_amount(end_time, now=None):
    """100 PKR base + 50/hr after a 10-minute grace period. No fine within grace."""
    end_time = parse_db_time(end_time)
    if end_time is None:
        return 0.0
    if now is None:
        now = datetime.utcnow()
    elif isinstance(now, datetime) and now.tzinfo:
        now = now.replace(tzinfo=None)
    delta_sec = (now - end_time).total_seconds()
    if delta_sec <= OVERSTAY_GRACE_MINUTES * 60:
        return 0.0
    billable_min = (delta_sec - OVERSTAY_GRACE_MINUTES * 60) / 60.0
    hours = max(1, math.ceil(billable_min / 60.0))
    return float(100 + 50 * (hours - 1))

# ===== HEALTH CHECK =====

@app.route('/api/health', methods=['GET'])
def health_check():
    """Test database connectivity and return status."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT DB_NAME() AS db_name")
        db_name = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Users")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Parking_Spots")
        spot_count = cursor.fetchone()[0]
        conn.close()
        return jsonify({
            "status": "connected",
            "database": db_name,
            "userCount": user_count,
            "spotCount": spot_count,
            "server": SERVER
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# ===== AUTH =====

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    h_pass = hash_password(password)

    conn = get_db()
    try:
        cursor = conn.cursor()
        # Check if role column exists
        try:
            cursor.execute(
                "SELECT user_id, name, email, wallet_balance, referral_code, role, vehicle_type_id FROM Users WHERE email = ? AND password = ?",
                (email, h_pass)
            )
        except:
            cursor.execute(
                "SELECT user_id, name, email, wallet_balance, referral_code, vehicle_type_id FROM Users WHERE email = ? AND password = ?",
                (email, h_pass)
            )
        user = cursor.fetchone()
        if user:
            role = user[5] if len(user) > 6 else 'user'
            v_type_id = user[6] if len(user) > 6 else (user[5] if len(user) == 6 else 2)
            return jsonify({
                "status": "success",
                "user": {
                    "id": user[0],
                    "name": user[1],
                    "email": user[2],
                    "wallet_balance": float(user[3]),
                    "referral_code": user[4],
                    "role": role,
                    "vehicle_type_id": v_type_id
                }
            })
        return jsonify({"status": "error", "message": "Invalid Credentials. Check your email and password."}), 401
    except Exception as e:
        return jsonify({"status": "error", "message": f"Login error: {str(e)}"}), 500
    finally:
        conn.close()

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    plate = data.get('vehiclePlate')
    v_type = 2 if data.get('vehicleType') == 'v2' else (1 if data.get('vehicleType') == 'v1' else 3)
    password = data.get('password')
    ref_code = data.get('referralCode')

    h_pass = hash_password(password)
    new_ref = name[:3].upper() + str(int(time.time()) % 1000)

    import re
    if not re.match(r'^\d{11}$', str(phone)):
        return jsonify({"status": "error", "message": "Phone number must be exactly 11 digits."}), 400
    if not re.match(r'^[A-Za-z]{3}-\d{3}$', str(plate)):
        return jsonify({"status": "error", "message": "Vehicle plate must be in format ABC-123."}), 400
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        # Check if email already exists
        cursor.execute("SELECT COUNT(*) FROM Users WHERE email = ?", (email,))
        if cursor.fetchone()[0] > 0:
            return jsonify({"status": "error", "message": "Email already registered."}), 400

        # Check if plate already exists
        cursor.execute("SELECT COUNT(*) FROM Users WHERE vehicle_plate = ?", (plate,))
        if cursor.fetchone()[0] > 0:
            return jsonify({"status": "error", "message": "Vehicle plate already registered."}), 400

        # Try with role column, fallback without
        try:
            cursor.execute(
                "INSERT INTO Users (name, email, phone, vehicle_plate, vehicle_type_id, password, wallet_balance, referral_code, role) VALUES (?, ?, ?, ?, ?, ?, 50.00, ?, 'user')",
                (name, email, phone, plate, v_type, h_pass, new_ref)
            )
        except:
            cursor.execute(
                "INSERT INTO Users (name, email, phone, vehicle_plate, vehicle_type_id, password, wallet_balance, referral_code) VALUES (?, ?, ?, ?, ?, ?, 50.00, ?)",
                (name, email, phone, plate, v_type, h_pass, new_ref)
            )
        user_id = cursor.execute("SELECT @@IDENTITY").fetchval()
        cursor.execute("INSERT INTO Loyalty_Points (user_id, points, lifetime_points) VALUES (?, 0, 0)", (user_id,))
        if ref_code:
            cursor.execute("UPDATE Loyalty_Points SET points = points + 200 WHERE user_id IN (SELECT user_id FROM Users WHERE referral_code = ?)", (ref_code,))
            cursor.execute("UPDATE Loyalty_Points SET points = points + 200 WHERE user_id = ?", (user_id,))
        return jsonify({"status": "success", "user_id": user_id})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Registration failed: {str(e)}"}), 400
    finally:
        conn.close()

# ===== PARKING SPOTS =====

@app.route('/api/parking/spots', methods=['GET'])
def get_spots():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT spot_id, zone_id, is_active FROM Parking_Spots")
        rows = cursor.fetchall()

        # Check which spots are currently occupied (active reservation)
        cursor.execute(
            "SELECT spot_id FROM Reservations WHERE status = 'active' AND end_time > GETUTCDATE()"
        )
        occupied = set(r[0] for r in cursor.fetchall())

        spots = []
        for r in rows:
            sid = str(r[0]).strip()
            zid = str(r[1]).strip()
            if r[2] == 0:
                status = "unavailable"
            elif sid in occupied:
                status = "occupied"
            else:
                status = "available"
            spots.append({"id": sid, "zone": zid, "status": status})
        return jsonify(spots)
    finally:
        conn.close()

# ===== BOOKING =====

@app.route('/api/parking/book', methods=['POST'])
def book_spot():
    data = request.json
    user_id = data.get('userId')
    spot_id = data.get('spotId')
    start = data.get('startTime')
    end = data.get('endTime')

    conn = get_db()
    try:
        cursor = conn.cursor()

        # Check if spot is already booked for the time range
        cursor.execute("""
            SELECT COUNT(*) FROM Reservations
            WHERE spot_id = ? AND status IN ('reserved', 'active')
            AND start_time < ? AND end_time > ?
        """, (spot_id, end, start))
        if cursor.fetchone()[0] > 0:
            return jsonify({"status": "error", "message": "Spot is already booked for this time period."}), 400

        # One user cannot overlap reservations (new booking must start after prior one ends)
        cursor.execute("""
            SELECT COUNT(*) FROM Reservations
            WHERE user_id = ? AND status IN ('reserved', 'active')
            AND start_time < ? AND end_time > ?
        """, (user_id, end, start))
        if cursor.fetchone()[0] > 0:
            return jsonify({
                "status": "error",
                "message": "You already have a reservation in this time window. Your next booking must start after your current reservation ends."
            }), 400

        # Get zone from spot_id
        cursor.execute("SELECT zone_id FROM Parking_Spots WHERE spot_id = ?", (spot_id,))
        zone_row = cursor.fetchone()
        zone = zone_row[0] if zone_row else 'A'

        cursor.execute("SELECT vehicle_type_id FROM Users WHERE user_id = ?", (user_id,))
        v_type = cursor.fetchone()[0]

        # Calculate duration in hours
        start_dt = datetime.fromisoformat(start.replace('Z', ''))
        end_dt = datetime.fromisoformat(end.replace('Z', ''))
        diff = (end_dt - start_dt).total_seconds() / 3600.0
        
        if diff > 4.0:
            return jsonify({"status": "error", "message": "Maximum booking duration is 4 hours."}), 400
            
        hours = max(1.0, round(diff, 2))

        # Handle Discount Code
        discount_amount = 0.0
        discount_code = data.get('discountCode')
        if discount_code:
            cursor.execute("SELECT amount_off FROM Discounts WHERE code = ? AND user_id = ? AND used = 0", (discount_code, user_id))
            disc_row = cursor.fetchone()
            if disc_row:
                discount_amount = float(disc_row[0])
                # Mark as used
                cursor.execute("UPDATE Discounts SET used = 1 WHERE code = ?", (discount_code,))
            else:
                return jsonify({"status": "error", "message": "Invalid or already used discount code."}), 400

        # Python-based Dynamic Pricing Replacement
        cursor.execute("SELECT base_rate FROM Vehicle_Types WHERE type_id = ?", (v_type,))
        base_rate = float(cursor.fetchone()[0])
        
        cursor.execute("SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ? AND is_active = 1", (zone,))
        total_zone_spots = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(DISTINCT r.spot_id)
            FROM Reservations r
            JOIN Parking_Spots p ON r.spot_id = p.spot_id
            WHERE p.zone_id = ?
              AND r.status IN ('reserved', 'active')
              AND r.start_time < ?
              AND r.end_time > ?
        """, (zone, end, start))
        active_overlapping = cursor.fetchone()[0]
        
        rate = base_rate * 1.2 if active_overlapping > 0.8 * total_zone_spots else base_rate
        
        final_price = max(0.0, (float(rate) * hours if rate else 80.0 * hours) - discount_amount)
        points_earned = int(final_price * 10)

        # Check wallet balance
        cursor.execute("SELECT wallet_balance FROM Users WHERE user_id = ?", (user_id,))
        balance = float(cursor.fetchone()[0])
        if balance < final_price:
            return jsonify({"status": "error", "message": f"Insufficient wallet balance. Need {final_price} PKR, have {balance} PKR."}), 400

        # Deduct from wallet
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance - ? WHERE user_id = ?", (final_price, user_id))

        # Create reservation (initially as 'reserved', not 'active')
        cursor.execute(
            "INSERT INTO Reservations (user_id, spot_id, start_time, end_time, status, final_price, points_earned) VALUES (?, ?, ?, ?, 'reserved', ?, ?)",
            (user_id, spot_id, start, end, final_price, points_earned)
        )

        # Add loyalty points
        cursor.execute("UPDATE Loyalty_Points SET points = points + ?, lifetime_points = lifetime_points + ? WHERE user_id = ?", (points_earned, points_earned, user_id))

        # Log wallet transaction
        cursor.execute(
            "INSERT INTO Wallet_Transactions (user_id, amount, type, description) VALUES (?, ?, 'book', ?)",
            (user_id, final_price, f'Booking spot {spot_id}')
        )

        # Log point transaction
        cursor.execute(
            "INSERT INTO Transactions (user_id, points_change, reason) VALUES (?, ?, ?)",
            (user_id, points_earned, f'Earned from booking {spot_id}')
        )

        return jsonify({"status": "success", "price": final_price})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/parking/validate-discount', methods=['POST'])
def validate_discount():
    data = request.json
    code = data.get('code')
    user_id = data.get('userId')
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT amount_off FROM Discounts WHERE code = ? AND user_id = ? AND used = 0", (code, user_id))
        row = cursor.fetchone()
        if row:
            return jsonify({"status": "success", "amountOff": float(row[0])})
        else:
            return jsonify({"status": "error", "message": "Invalid or already used code."}), 400
    finally:
        conn.close()

# ===== USER DASHBOARD =====

@app.route('/api/user/<int:user_id>/dashboard', methods=['GET'])
def user_dashboard(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        # Note: We no longer auto-complete sessions here. 
        # A session stays 'active' until the user manually leaves.
        
        cursor.execute("SELECT wallet_balance, referral_code FROM Users WHERE user_id = ?", (user_id,))
        user_row = cursor.fetchone()
        wallet = float(user_row[0]) if user_row else 0
        referral_code = user_row[1] if user_row else ''

        cursor.execute("SELECT points, lifetime_points FROM Loyalty_Points WHERE user_id = ?", (user_id,))
        lp_row = cursor.fetchone()
        points = lp_row[0] if lp_row else 0
        lifetime_points = lp_row[1] if lp_row else 0

        # Return reservations with statuses: reserved, active, completed, etc.
        cursor.execute(
            "SELECT TOP 5 reservation_id, spot_id, start_time, end_time, status, final_price FROM Reservations WHERE user_id = ? ORDER BY reservation_id DESC",
            (user_id,)
        )
        res_rows = cursor.fetchall()
        history = []
        for r in res_rows:
            history.append({
                "id": r[0],
                "spotId": r[1],
                "startTime": (r[2].isoformat() + 'Z') if r[2] else '',
                "endTime": (r[3].isoformat() + 'Z') if r[3] else '',
                "status": r[4],
                "finalPrice": float(r[5]) if r[5] else 0
            })

        return jsonify({
            "wallet": wallet,
            "points": points,
            "lifetimePoints": lifetime_points,
            "referralCode": referral_code,
            "history": history
        })
    finally:
        conn.close()

# ===== VIOLATIONS =====

@app.route('/api/user/<int:user_id>/violations', methods=['GET'])
def get_user_violations(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT v.violation_id, v.reservation_id, v.fine_amount, v.is_paid, v.created_at
            FROM Violations v
            JOIN Reservations r ON v.reservation_id = r.reservation_id
            WHERE r.user_id = ?
            ORDER BY v.created_at DESC
        """, (user_id,))
        rows = cursor.fetchall()
        violations = []
        for r in rows:
            violations.append({
                "id": r[0],
                "reservationId": r[1],
                "fineAmount": float(r[2]),
                "isPaid": bool(r[3]),
                "createdAt": r[4].isoformat() if r[4] else ''
            })
        return jsonify(violations)
    finally:
        conn.close()

@app.route('/api/user/<int:user_id>/violations/pay', methods=['POST'])
def pay_violation(user_id):
    data = request.json
    violation_id = data.get('violationId')

    conn = get_db()
    try:
        cursor = conn.cursor()
        # Get fine amount
        cursor.execute("SELECT fine_amount FROM Violations WHERE violation_id = ? AND is_paid = 0", (violation_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Violation not found or already paid"}), 404

        fine = float(row[0])

        # Check wallet balance
        cursor.execute("SELECT wallet_balance FROM Users WHERE user_id = ?", (user_id,))
        balance = float(cursor.fetchone()[0])
        if balance < fine:
            return jsonify({"status": "error", "message": "Insufficient wallet balance"}), 400

        # Deduct and mark paid
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance - ? WHERE user_id = ?", (fine, user_id))
        cursor.execute("UPDATE Violations SET is_paid = 1 WHERE violation_id = ?", (violation_id,))

        # Log wallet transaction
        cursor.execute(
            "INSERT INTO Wallet_Transactions (user_id, amount, type, description) VALUES (?, ?, 'fine', ?)",
            (user_id, fine, f'Violation #{violation_id} fine payment')
        )

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/user/<int:user_id>/violations/check', methods=['POST'])
def check_overstays(user_id):
    """Check for expired active reservations and create violations."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        # Find active reservations that have expired
        cursor.execute("""
            SELECT reservation_id, end_time
            FROM Reservations
            WHERE user_id = ? AND status = 'active' AND end_time < GETDATE()
        """, (user_id,))
        expired = cursor.fetchall()

        created = 0
        now = datetime.utcnow()
        for r in expired:
            res_id = r[0]
            fine = overstay_fine_amount(r[1], now)
            if fine > 0:
                cursor.execute("SELECT COUNT(*) FROM Violations WHERE reservation_id = ?", (res_id,))
                if cursor.fetchone()[0] == 0:
                    cursor.execute(
                        "INSERT INTO Violations (reservation_id, fine_amount, is_paid) VALUES (?, ?, 0)",
                        (res_id, fine)
                    )
                    created += 1
            cursor.execute(
                "UPDATE Reservations SET status = 'completed' WHERE reservation_id = ? AND status = 'active'",
                (res_id,)
            )

        # Close reserved sessions that ended without check-in (no fine)
        cursor.execute("""
            SELECT reservation_id FROM Reservations
            WHERE user_id = ? AND status = 'reserved' AND end_time < GETUTCDATE()
        """, (user_id,))
        for row in cursor.fetchall():
            cursor.execute(
                "UPDATE Reservations SET status = 'completed' WHERE reservation_id = ? AND status = 'reserved'",
                (row[0],)
            )

        return jsonify({"status": "success", "violationsCreated": created})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

# ===== LOYALTY =====

@app.route('/api/user/<int:user_id>/loyalty', methods=['GET'])
def get_loyalty(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT points, lifetime_points FROM Loyalty_Points WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        points = row[0] if row else 0
        lifetime = row[1] if row else 0

        cursor.execute(
            "SELECT transaction_id, points_change, reason, created_at FROM Transactions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        txs = []
        for r in cursor.fetchall():
            txs.append({
                "id": r[0],
                "change": r[1],
                "reason": r[2],
                "date": r[3].isoformat() if r[3] else ''
            })

        return jsonify({"points": points, "lifetimePoints": lifetime, "transactions": txs})
    finally:
        conn.close()

@app.route('/api/user/<int:user_id>/loyalty/redeem', methods=['POST'])
def redeem_points(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT points FROM Loyalty_Points WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row or row[0] < 500:
            return jsonify({"status": "error", "message": "Need at least 500 points"}), 400

        # Generate discount code
        code = f"DISC-{user_id}-{int(time.time()) % 10000}"

        # Deduct points
        cursor.execute("UPDATE Loyalty_Points SET points = points - 500 WHERE user_id = ?", (user_id,))

        # Create discount
        cursor.execute(
            "INSERT INTO Discounts (user_id, code, amount_off, used) VALUES (?, ?, 50.00, 0)",
            (user_id, code)
        )

        # Log transaction
        cursor.execute(
            "INSERT INTO Transactions (user_id, points_change, reason) VALUES (?, -500, ?)",
            (user_id, f'Redeemed for coupon {code}')
        )

        return jsonify({"status": "success", "code": code})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

# ===== WALLET =====

@app.route('/api/user/<int:user_id>/wallet', methods=['GET'])
def get_wallet(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT wallet_balance FROM Users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        balance = float(row[0]) if row else 0

        cursor.execute(
            "SELECT trans_id, amount, type, description, created_at FROM Wallet_Transactions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        txs = []
        for r in cursor.fetchall():
            txs.append({
                "id": r[0],
                "amount": float(r[1]),
                "type": r[2],
                "description": r[3],
                "date": r[4].isoformat() if r[4] else ''
            })

        return jsonify({"balance": balance, "transactions": txs})
    finally:
        conn.close()

@app.route('/api/user/<int:user_id>/wallet/topup', methods=['POST'])
def topup_wallet(user_id):
    data = request.json
    amount = data.get('amount', 0)

    if amount <= 0:
        return jsonify({"status": "error", "message": "Invalid amount"}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance + ? WHERE user_id = ?", (amount, user_id))
        cursor.execute(
            "INSERT INTO Wallet_Transactions (user_id, amount, type, description) VALUES (?, ?, 'add', ?)",
            (user_id, amount, f'Added {amount} PKR via Digital Wallet')
        )
        cursor.execute("SELECT wallet_balance FROM Users WHERE user_id = ?", (user_id,))
        new_balance = float(cursor.fetchone()[0])
        return jsonify({"status": "success", "newBalance": new_balance})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

# ===== BOOKINGS =====

@app.route('/api/user/<int:user_id>/bookings', methods=['GET'])
def get_bookings(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT reservation_id, spot_id, start_time, end_time, status, final_price, points_earned FROM Reservations WHERE user_id = ? ORDER BY reservation_id DESC",
            (user_id,)
        )
        bookings = []
        for r in cursor.fetchall():
            bookings.append({
                "id": r[0],
                "spotId": r[1],
                "startTime": (r[2].isoformat() + 'Z') if r[2] else '',
                "endTime": (r[3].isoformat() + 'Z') if r[3] else '',
                "status": r[4],
                "finalPrice": float(r[5]) if r[5] else 0,
                "pointsEarned": r[6] if r[6] else 0
            })
        return jsonify(bookings)
    finally:
        conn.close()

@app.route('/api/user/<int:user_id>/bookings/cancel', methods=['POST'])
def cancel_booking(user_id):
    data = request.json
    reservation_id = data.get('reservationId')

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT final_price, points_earned FROM Reservations
            WHERE reservation_id = ? AND user_id = ?
              AND status IN ('reserved', 'active')
              AND GETUTCDATE() < DATEADD(minute, 10, start_time)
            """,
            (reservation_id, user_id)
        )
        row = cursor.fetchone()
        if not row:
            cursor.execute(
                "SELECT status FROM Reservations WHERE reservation_id = ? AND user_id = ?",
                (reservation_id, user_id)
            )
            check = cursor.fetchone()
            if not check:
                return jsonify({"status": "error", "message": "Reservation not found"}), 404
            if check[0] in ('cancelled', 'completed'):
                return jsonify({"status": "error", "message": "This reservation cannot be cancelled."}), 400
            return jsonify({
                "status": "error",
                "message": "Cancellation window closed. You can cancel before start or within 10 minutes after start time."
            }), 400

        refund = float(row[0])
        points_earned = int(row[1]) if row[1] else 0

        cursor.execute("UPDATE Reservations SET status = 'cancelled' WHERE reservation_id = ?", (reservation_id,))
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance + ? WHERE user_id = ?", (refund, user_id))
        cursor.execute(
            "INSERT INTO Wallet_Transactions (user_id, amount, type, description) VALUES (?, ?, 'refund', ?)",
            (user_id, refund, f'Refund for cancelled reservation #{reservation_id}')
        )

        if points_earned > 0:
            cursor.execute(
                "UPDATE Loyalty_Points SET points = CASE WHEN points >= ? THEN points - ? ELSE 0 END WHERE user_id = ?",
                (points_earned, points_earned, user_id)
            )
            cursor.execute(
                "INSERT INTO Transactions (user_id, points_change, reason) VALUES (?, ?, ?)",
                (user_id, -points_earned, f'Reversed for cancelled reservation #{reservation_id}')
            )

        return jsonify({"status": "success", "refund": refund})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

# ===== ARRIVAL & DEPARTURE =====

@app.route('/api/parking/arrive', methods=['POST'])
def check_in():
    data = request.json
    res_id = data.get('reservationId')
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Reservations SET status = 'active' WHERE reservation_id = ?", (res_id,))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/parking/leave', methods=['POST'])
def check_out():
    data = request.json
    res_id = data.get('reservationId')
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        # Get reservation details
        cursor.execute("SELECT end_time, user_id, status FROM Reservations WHERE reservation_id = ?", (res_id,))
        res = cursor.fetchone()
        if not res:
            return jsonify({"status": "error", "message": "Reservation not found"}), 404
            
        end_time = res[0]
        status = res[2]

        if status in ('completed', 'cancelled'):
            return jsonify({"status": "success", "message": "Already checked out"})

        if status == 'reserved':
            cursor.execute(
                "UPDATE Reservations SET status = 'completed' WHERE reservation_id = ? AND status = 'reserved'",
                (res_id,)
            )
            return jsonify({"status": "success", "message": "Reservation closed without parking session."})

        if status != 'active':
            return jsonify({"status": "error", "message": "Only active parking sessions can be checked out."}), 400

        now = datetime.utcnow()
        cursor.execute(
            "UPDATE Reservations SET status = 'completed' WHERE reservation_id = ? AND status = 'active'",
            (res_id,)
        )
        if cursor.rowcount == 0:
            return jsonify({"status": "success", "message": "Already checked out"})

        fine = overstay_fine_amount(end_time, now)
        if fine > 0:
            cursor.execute("SELECT COUNT(*) FROM Violations WHERE reservation_id = ?", (res_id,))
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "INSERT INTO Violations (reservation_id, fine_amount, is_paid) VALUES (?, ?, 0)",
                    (res_id, fine)
                )

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

# ===== LEADERBOARD =====

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT TOP 10 u.user_id, u.name, lp.points, lp.lifetime_points
            FROM Users u
            JOIN Loyalty_Points lp ON u.user_id = lp.user_id
            WHERE u.role != 'admin'
            ORDER BY lp.points DESC
        """)
        users = []
        for r in cursor.fetchall():
            users.append({
                "id": r[0],
                "name": r[1],
                "points": r[2],
                "lifetimePoints": r[3]
            })

        # Get total count (excluding admins)
        cursor.execute("SELECT COUNT(*) FROM Users WHERE role != 'admin'")
        total = cursor.fetchone()[0]

        return jsonify({"leaderboard": users, "totalUsers": total})
    finally:
        conn.close()

# --- ROLES HELPER ---
def is_admin(user_id):
    if not user_id:
        return False
    conn = get_db()
    try:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT role FROM Users WHERE user_id = ?", (user_id,))
        except:
            return False # Role column might not exist yet
        row = cursor.fetchone()
        return row and row[0] == 'admin'
    except:
        return False
    finally:
        conn.close()

# ===== ADMIN =====

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized. Admin access required."}), 403

    conn = get_db()
    try:
        cursor = conn.cursor()
        from datetime import datetime, timezone
        time_now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Total revenue
        cursor.execute("SELECT ISNULL(SUM(final_price), 0) FROM Reservations WHERE status != 'cancelled'")
        total_revenue = float(cursor.fetchone()[0])

        # Total users
        cursor.execute("SELECT COUNT(*) FROM Users")
        total_users = cursor.fetchone()[0]

        # Active bookings (actually currently parked/occupying a spot)
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE status = 'active' AND end_time > GETUTCDATE()")
        active_bookings = cursor.fetchone()[0]

        # Completed bookings
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE status = 'completed'")
        completed_bookings = cursor.fetchone()[0]

        # Cancelled bookings
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE status = 'cancelled'")
        cancelled_bookings = cursor.fetchone()[0]

        # Total bookings
        cursor.execute("SELECT COUNT(*) FROM Reservations")
        total_bookings = cursor.fetchone()[0]

        # Total violations
        cursor.execute("SELECT COUNT(*) FROM Violations")
        total_violations = cursor.fetchone()[0]

        # Unpaid violations
        cursor.execute("SELECT COUNT(*) FROM Violations WHERE is_paid = 0")
        unpaid_violations = cursor.fetchone()[0]

        # Revenue by day (last 7 days)
        cursor.execute("""
            SELECT CAST(created_at AS DATE) as day, ISNULL(SUM(final_price), 0) as revenue
            FROM Reservations
            WHERE status != 'cancelled' AND created_at >= DATEADD(day, -7, GETUTCDATE())
            GROUP BY CAST(created_at AS DATE)
            ORDER BY day
        """)
        daily_revenue = []
        for r in cursor.fetchall():
            daily_revenue.append({
                "day": r[0].isoformat() if r[0] else '',
                "revenue": float(r[1])
            })



        # Data Fix: Ensure A12 is in Zone A
        cursor.execute("UPDATE Parking_Spots SET zone_id = 'A' WHERE spot_id = 'A12' AND zone_id = 'C'")
        
        # Zone occupancy - Dynamic Zone Detection
        zone_occupancy = []
        cursor.execute("SELECT DISTINCT zone_id FROM Parking_Spots")
        found_zones = [str(r[0]).strip() for r in cursor.fetchall()]
        
        running_active_count = 0
        for zone_id in sorted(list(set(found_zones))):
            # Count ALL spots in zone 
            cursor.execute("SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ?", (zone_id,))
            total_in_zone = cursor.fetchone()[0]
            
            # Check if zone is online (count only naturally active spots)
            cursor.execute("SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ? AND is_active = 1", (zone_id,))
            online_spots = cursor.fetchone()[0]
            
            # Count only ACTIVE (occupied) spots - time restricted
            cursor.execute("""
                SELECT COUNT(DISTINCT r.spot_id) FROM Reservations r
                JOIN Parking_Spots s ON r.spot_id = s.spot_id
                WHERE s.zone_id = ? AND r.status = 'active' AND r.end_time > GETUTCDATE()
            """, (zone_id,))
            occupied_in_zone = cursor.fetchone()[0]
            running_active_count += occupied_in_zone
            
            zone_occupancy.append({
                "zone": zone_id,
                "total": total_in_zone,
                "online": online_spots,
                "occupied": occupied_in_zone,
                "available": max(0, online_spots - occupied_in_zone)
            })

        # Override active_bookings with the actual sum from spots to ensure 100% UI consistency
        active_bookings = running_active_count

        # Dynamic pricing state per zone
        pricing_state = []
        for zone_id in sorted(found_zones):
            cursor.execute("SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ? AND is_active = 1", (zone_id,))
            total_spots = cursor.fetchone()[0]
            cursor.execute("""
                SELECT COUNT(DISTINCT s.spot_id) FROM Reservations r
                JOIN Parking_Spots s ON r.spot_id = s.spot_id
                WHERE s.zone_id = ? AND r.status = 'active' AND r.end_time > GETUTCDATE()
            """, (zone_id,))
            occ = cursor.fetchone()[0]
            occupancy_pct = (occ / total_spots * 100) if total_spots > 0 else 0
            multiplier = 1.2 if occupancy_pct > 80 else 1.0
            pricing_state.append({
                "zone": zone_id,
                "occupancyPercent": round(occupancy_pct, 1),
                "multiplier": multiplier,
                "surgeActive": multiplier > 1.0
            })

        # Bookings per day (last 7 days)
        cursor.execute("""
            SELECT CAST(created_at AS DATE) as day, COUNT(*) as cnt
            FROM Reservations
            WHERE created_at >= DATEADD(day, -7, GETUTCDATE())
            GROUP BY CAST(created_at AS DATE)
            ORDER BY day
        """)
        daily_bookings = []
        for r in cursor.fetchall():
            daily_bookings.append({
                "day": r[0].isoformat() if r[0] else '',
                "count": r[1]
            })

        # All violations for admin table
        cursor.execute("""
            SELECT v.violation_id, r.user_id, u.name, v.reservation_id, v.fine_amount, v.is_paid, v.created_at
            FROM Violations v
            JOIN Reservations r ON v.reservation_id = r.reservation_id
            JOIN Users u ON r.user_id = u.user_id
            ORDER BY v.created_at DESC
        """)
        violations = []
        for r in cursor.fetchall():
            violations.append({
                "id": r[0],
                "userId": r[1],
                "userName": r[2],
                "reservationId": r[3],
                "fineAmount": float(r[4]),
                "isPaid": bool(r[5]),
                "createdAt": (r[6].isoformat() + 'Z') if r[6] else ''
            })

        # Recent reservations for admin
        cursor.execute("""
            SELECT TOP 10 r.reservation_id, u.name, r.spot_id, r.start_time, r.end_time, r.status, r.final_price, r.created_at
            FROM Reservations r JOIN Users u ON r.user_id = u.user_id
            ORDER BY r.created_at DESC
        """)
        recent_bookings = []
        for r in cursor.fetchall():
            res_status = r[5]
            # Dynamic completion check
            if res_status == 'active' and r[4] and r[4] < time_now:
                res_status = 'completed'
                
            recent_bookings.append({
                "id": r[0],
                "userName": r[1],
                "spotId": r[2],
                "startTime": (r[3].isoformat() + 'Z') if r[3] else '',
                "endTime": (r[4].isoformat() + 'Z') if r[4] else '',
                "status": res_status,
                "finalPrice": float(r[6]) if r[6] else 0,
                "createdAt": (r[7].isoformat() + 'Z') if r[7] else ''
            })

        return jsonify({
            "totalRevenue": total_revenue,
            "totalUsers": total_users,
            "activeBookings": active_bookings,
            "completedBookings": completed_bookings,
            "cancelledBookings": cancelled_bookings,
            "totalBookings": total_bookings,
            "totalViolations": total_violations,
            "unpaidViolations": unpaid_violations,
            "dailyRevenue": daily_revenue,
            "dailyBookings": daily_bookings,
            "zoneOccupancy": zone_occupancy,
            "pricingState": pricing_state,
            "violations": violations,
            "recentBookings": recent_bookings
        })
    finally:
        conn.close()

@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    """List all registered users from the database."""
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized. Admin access required."}), 403

    conn = get_db()
    try:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT u.user_id, u.name, u.email, u.phone, u.vehicle_plate, u.wallet_balance, u.referral_code, u.role, u.created_at,
                       ISNULL(lp.points, 0) as points, ISNULL(lp.lifetime_points, 0) as lifetime_points,
                       (SELECT COUNT(*) FROM Reservations WHERE user_id = u.user_id) as total_bookings,
                       u.vehicle_type_id
                FROM Users u
                LEFT JOIN Loyalty_Points lp ON u.user_id = lp.user_id
                ORDER BY u.created_at DESC
            """)
        except:
            cursor.execute("""
                SELECT u.user_id, u.name, u.email, u.phone, u.vehicle_plate, u.wallet_balance, u.referral_code, 'user' as role, u.created_at,
                       ISNULL(lp.points, 0) as points, ISNULL(lp.lifetime_points, 0) as lifetime_points,
                       (SELECT COUNT(*) FROM Reservations WHERE user_id = u.user_id) as total_bookings,
                       2 as vehicle_type_id
                FROM Users u
                LEFT JOIN Loyalty_Points lp ON u.user_id = lp.user_id
                ORDER BY u.created_at DESC
            """)
        users = []
        for r in cursor.fetchall():
            users.append({
                "id": r[0],
                "name": r[1],
                "email": r[2],
                "phone": r[3],
                "vehiclePlate": r[4],
                "walletBalance": float(r[5]) if r[5] else 0,
                "referralCode": r[6],
                "role": r[7] if r[7] else 'user',
                "createdAt": (r[8].isoformat() + 'Z') if r[8] else '',
                "points": r[9],
                "lifetimePoints": r[10],
                "totalBookings": r[11],
                "vehicleTypeId": r[12]
            })
        return jsonify({"users": users, "totalCount": len(users)})
    finally:
        conn.close()

@app.route('/api/admin/users/<int:user_id>', methods=['PATCH'])
def update_user_admin(user_id):
    import re
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    data = request.json
    name = data.get('name')
    phone = data.get('phone')
    plate = data.get('vehiclePlate')
    role = data.get('role')
    points = data.get('points')
    wallet = data.get('walletBalance')
    v_type = data.get('vehicleTypeId') # New field

    if not re.match(r'^\d{11}$', str(phone)):
        return jsonify({"status": "error", "message": "Phone number must be exactly 11 digits."}), 400
    if not re.match(r'^[A-Za-z]{3}-\d{3}$', str(plate)):
        return jsonify({"status": "error", "message": "Vehicle plate must be in format ABC-123."}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        # Update User fields
        cursor.execute("""
            UPDATE Users SET name = ?, phone = ?, vehicle_plate = ?, role = ?, wallet_balance = ?, vehicle_type_id = ?
            WHERE user_id = ?
        """, (name, phone, plate, role, wallet, v_type, user_id))
        
        # Update points if provided
        if points is not None:
            cursor.execute("UPDATE Loyalty_Points SET points = ? WHERE user_id = ?", (points, user_id))
            
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user_admin(user_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        # 1. Delete Violations linked to user's reservations
        cursor.execute("DELETE FROM Violations WHERE reservation_id IN (SELECT reservation_id FROM Reservations WHERE user_id = ?)", (user_id,))
        # 2. Delete Reservations
        cursor.execute("DELETE FROM Reservations WHERE user_id = ?", (user_id,))
        # 3. Delete related logs
        cursor.execute("DELETE FROM Loyalty_Points WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Transactions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Wallet_Transactions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Discounts WHERE user_id = ?", (user_id,))
        # 4. Delete User
        cursor.execute("DELETE FROM Users WHERE user_id = ?", (user_id,))
        
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/admin/spots', methods=['POST'])
def add_spot():
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    data = request.json
    spot_id = data.get('spotId') # e.g. "A11"
    zone_id = data.get('zoneId') # e.g. "A"
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        
        # Enforce max 20 spots per zone constraint
        cursor.execute("SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ?", (zone_id,))
        count = cursor.fetchone()[0]
        if count >= 20:
            return jsonify({"status": "error", "message": f"Maximum capacity reached. Zone {zone_id} cannot exceed 20 spots."}), 400
            
        cursor.execute("INSERT INTO Parking_Spots (spot_id, zone_id, is_active) VALUES (?, ?, 1)", (spot_id, zone_id))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/admin/spots/<spot_id>', methods=['DELETE'])
def delete_spot(spot_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        # Check if spot has ever been used (reservations)
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE spot_id = ?", (spot_id,))
        if cursor.fetchone()[0] > 0:
            # Safer to de-activate rather than delete if history exists
            cursor.execute("UPDATE Parking_Spots SET is_active = 0 WHERE spot_id = ?", (spot_id,))
            return jsonify({"status": "success", "message": "Spot had history, so it was de-activated instead of deleted."})
        
        cursor.execute("DELETE FROM Parking_Spots WHERE spot_id = ?", (spot_id,))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/admin/spots/<spot_id>/status', methods=['PATCH'])
def toggle_spot_status(spot_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    data = request.json
    active = 1 if data.get('active') else 0
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        
        # RESTRICTION: Check for active bookings
        if not active:
            cursor.execute("""
                SELECT COUNT(*) FROM Reservations 
                WHERE spot_id = ? AND status = 'active' AND end_time > GETUTCDATE()
            """, (spot_id,))
            count = cursor.fetchone()[0]
            if count > 0:
                return jsonify({"status": "error", "message": f"Cannot take spot {spot_id} offline. It has {count} active reservation(s)."}), 400

        cursor.execute("UPDATE Parking_Spots SET is_active = ? WHERE spot_id = ?", (active, spot_id))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/admin/zones/<zone_id>/status', methods=['PATCH'])
def toggle_zone_status(zone_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    data = request.json
    active = 1 if data.get('active') else 0
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        
        # RESTRICTION: Check for active bookings in entire zone
        if not active:
            cursor.execute("""
                SELECT spot_id FROM Reservations 
                WHERE spot_id IN (SELECT spot_id FROM Parking_Spots WHERE zone_id = ?)
                AND status = 'active' AND end_time > GETUTCDATE()
            """, (zone_id,))
            active_spots = [str(r[0]).strip() for r in cursor.fetchall()]
            if active_spots:
                return jsonify({"status": "error", "message": f"Cannot deactivate Zone {zone_id}. The following spots are still occupied: {', '.join(active_spots)}"}), 400

        cursor.execute("UPDATE Parking_Spots SET is_active = ? WHERE zone_id = ?", (active, zone_id))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
@app.route('/api/admin/bookings/<int:res_id>/force-complete', methods=['POST'])
def force_complete_booking(res_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Reservations SET status = 'completed' WHERE reservation_id = ?", (res_id,))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

# ===== ADMIN VIOLATIONS =====

@app.route('/api/admin/violations/<int:v_id>', methods=['DELETE'])
def delete_violation(v_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Violations WHERE violation_id = ?", (v_id,))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

@app.route('/api/admin/violations/<int:v_id>/pay', methods=['PATCH'])
def mark_violation_paid(v_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Violations SET is_paid = 1 WHERE violation_id = ?", (v_id,))
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    finally:
        conn.close()

# ===== REPORTS =====

@app.route('/api/reports/<report_type>', methods=['GET'])
def generate_report(report_type):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized. Admin access required."}), 403

    conn = get_db()
    try:
        cursor = conn.cursor()
        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == 'revenue':
            writer.writerow(['Date', 'Total Revenue', 'Bookings Count'])
            cursor.execute("""
                SELECT CAST(created_at AS DATE), SUM(final_price), COUNT(*)
                FROM Reservations WHERE status != 'cancelled'
                GROUP BY CAST(created_at AS DATE) ORDER BY 1 DESC
            """)
            for r in cursor.fetchall():
                writer.writerow([str(r[0]), float(r[1]), r[2]])

        elif report_type == 'customers':
            writer.writerow(['User ID', 'Name', 'Email', 'Total Spent', 'Bookings'])
            cursor.execute("""
                SELECT u.user_id, u.name, u.email,
                    ISNULL(SUM(r.final_price), 0), COUNT(r.reservation_id)
                FROM Users u LEFT JOIN Reservations r ON u.user_id = r.user_id AND r.status != 'cancelled'
                GROUP BY u.user_id, u.name, u.email
                ORDER BY 4 DESC
            """)
            for r in cursor.fetchall():
                writer.writerow([r[0], r[1], r[2], float(r[3]), r[4]])

        elif report_type == 'leaderboard':
            writer.writerow(['Rank', 'User ID', 'Name', 'Points', 'Lifetime Points'])
            cursor.execute("""
                SELECT u.user_id, u.name, lp.points, lp.lifetime_points
                FROM Users u JOIN Loyalty_Points lp ON u.user_id = lp.user_id
                ORDER BY lp.points DESC
            """)
            for i, r in enumerate(cursor.fetchall(), 1):
                writer.writerow([i, r[0], r[1], r[2], r[3]])

        elif report_type == 'violations':
            writer.writerow(['Violation ID', 'User ID', 'Reservation ID', 'Fine Amount', 'Status', 'Date'])
            cursor.execute("""
                SELECT v.violation_id, r.user_id, v.reservation_id, v.fine_amount,
                    CASE WHEN v.is_paid = 1 THEN 'Paid' ELSE 'Unpaid' END, v.created_at
                FROM Violations v JOIN Reservations r ON v.reservation_id = r.reservation_id
                ORDER BY v.created_at DESC
            """)
            for r in cursor.fetchall():
                writer.writerow([r[0], r[1], r[2], float(r[3]), r[4], str(r[5])])
        else:
            return jsonify({"status": "error", "message": "Unknown report type"}), 400

        csv_content = output.getvalue()
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename={report_type}_report.csv'}
        )
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
