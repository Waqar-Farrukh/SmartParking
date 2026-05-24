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
from fpdf import FPDF
import os
import tempfile

temp_dir = tempfile.gettempdir()
os.environ['MPLCONFIGDIR'] = temp_dir
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

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
            # 7 cols: id,name,email,wallet,ref,role,vtype | 6 cols: no role column
            if len(user) >= 7:
                role = user[5] or 'user'
                v_type_id = user[6]
            else:
                role = 'user'
                v_type_id = user[5] if len(user) >= 6 else 2
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

        # Active = checked in; reserved = booked but not yet arrived
        cursor.execute(
            "SELECT spot_id FROM Reservations WHERE status = 'active' AND end_time > GETUTCDATE()"
        )
        occupied = set(str(r[0]).strip() for r in cursor.fetchall())
        cursor.execute(
            "SELECT spot_id FROM Reservations WHERE status = 'reserved' AND end_time > GETUTCDATE()"
        )
        reserved = set(str(r[0]).strip() for r in cursor.fetchall())

        spots = []
        for r in rows:
            sid = str(r[0]).strip()
            zid = str(r[1]).strip()
            if r[2] == 0:
                status = "unavailable"
            elif sid in occupied:
                status = "occupied"
            elif sid in reserved:
                status = "reserved"
            else:
                status = "available"
            spots.append({"id": sid, "zone": zid, "status": status})
        return jsonify(spots)
    finally:
        conn.close()

# ===== BOOKING =====

SURGE_OCCUPANCY_RATIO = 0.8  # surge when >80% of active spots booked in the time window


def _compute_booking_quote(cursor, zone, vehicle_type_id, start, end):
    """Shared pricing: matches admin surge logic to the requested time window."""
    start_dt = datetime.fromisoformat(start.replace('Z', '').split('+')[0])
    end_dt = datetime.fromisoformat(end.replace('Z', '').split('+')[0])
    diff = (end_dt - start_dt).total_seconds() / 3600.0

    if diff <= 0:
        return None, 'Exit time must be after start time.'
    if diff > 4.0:
        return None, 'Maximum booking duration is 4 hours.'

    hours = max(1.0, round(diff, 2))

    cursor.execute('SELECT base_rate FROM Vehicle_Types WHERE type_id = ?', (vehicle_type_id,))
    row = cursor.fetchone()
    base_rate = float(row[0]) if row else 80.0

    cursor.execute(
        'SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ? AND is_active = 1',
        (zone,),
    )
    total_active = cursor.fetchone()[0] or 0
    if total_active == 0:
        return None, f'Zone {zone} has no active spots.'

    cursor.execute(
        """
        SELECT COUNT(DISTINCT r.spot_id)
        FROM Reservations r
        JOIN Parking_Spots p ON r.spot_id = p.spot_id
        WHERE p.zone_id = ?
          AND p.is_active = 1
          AND r.status IN ('reserved', 'active')
          AND r.start_time < ?
          AND r.end_time > ?
        """,
        (zone, end, start),
    )
    booked_in_window = cursor.fetchone()[0]
    threshold = SURGE_OCCUPANCY_RATIO * total_active
    is_surge = booked_in_window > threshold
    rate = base_rate * 1.2 if is_surge else base_rate
    price = float(rate) * hours
    occupancy_percent = int((booked_in_window / total_active) * 100) if total_active else 0

    return {
        'hours': hours,
        'baseRate': base_rate,
        'rate': rate,
        'price': round(price, 2),
        'isSurge': is_surge,
        'occupancyPercent': occupancy_percent,
        'bookedInWindow': booked_in_window,
        'activeSpotsInZone': total_active,
        'zone': str(zone).strip(),
    }, None


@app.route('/api/parking/price-quote', methods=['POST'])
def price_quote():
    data = request.json or {}
    user_id = data.get('userId')
    start = data.get('startTime')
    end = data.get('endTime')
    zone = data.get('zone')
    spot_id = data.get('spotId')

    if not user_id or not start or not end:
        return jsonify({'status': 'error', 'message': 'userId, startTime, and endTime are required.'}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT vehicle_type_id FROM Users WHERE user_id = ?', (user_id,))
        urow = cursor.fetchone()
        if not urow:
            return jsonify({'status': 'error', 'message': 'User not found.'}), 404
        v_type = urow[0]

        if spot_id:
            cursor.execute(
                'SELECT zone_id FROM Parking_Spots WHERE spot_id = ? AND is_active = 1',
                (spot_id,),
            )
            zrow = cursor.fetchone()
            if not zrow:
                return jsonify({'status': 'error', 'message': 'Spot not found or offline.'}), 400
            zone = zrow[0]
        if not zone:
            return jsonify({'status': 'error', 'message': 'zone or spotId is required.'}), 400

        quote, err = _compute_booking_quote(cursor, str(zone).strip(), v_type, start, end)
        if err:
            return jsonify({'status': 'error', 'message': err}), 400
        return jsonify({'status': 'success', **quote})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    finally:
        conn.close()


@app.route('/api/parking/zone-pricing', methods=['POST'])
def zone_pricing():
    """Surge flags per zone for the selected time window (booking UI zone tabs)."""
    data = request.json or {}
    user_id = data.get('userId')
    start = data.get('startTime')
    end = data.get('endTime')

    if not user_id or not start or not end:
        return jsonify({'status': 'error', 'message': 'userId, startTime, and endTime are required.'}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT vehicle_type_id FROM Users WHERE user_id = ?', (user_id,))
        urow = cursor.fetchone()
        if not urow:
            return jsonify({'status': 'error', 'message': 'User not found.'}), 404
        v_type = urow[0]

        zones_out = {}
        for z in ['A', 'B', 'C']:
            quote, err = _compute_booking_quote(cursor, z, v_type, start, end)
            if err:
                zones_out[z] = {'error': err}
            else:
                zones_out[z] = quote
        return jsonify({'status': 'success', 'zones': zones_out})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    finally:
        conn.close()


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

        quote, err = _compute_booking_quote(cursor, zone, v_type, start, end)
        if err:
            return jsonify({"status": "error", "message": err}), 400

        hours = quote['hours']
        final_price_before_discount = quote['price']

        # Handle Discount Code
        discount_amount = 0.0
        discount_code = data.get('discountCode')
        if discount_code:
            cursor.execute("SELECT amount_off FROM Discounts WHERE code = ? AND user_id = ? AND used = 0", (discount_code, user_id))
            disc_row = cursor.fetchone()
            if disc_row:
                discount_amount = float(disc_row[0])
                cursor.execute("UPDATE Discounts SET used = 1 WHERE code = ?", (discount_code,))
            else:
                return jsonify({"status": "error", "message": "Invalid or already used discount code."}), 400

        final_price = max(0.0, final_price_before_discount - discount_amount)
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
        cursor.execute("SELECT wallet_balance, referral_code FROM Users WHERE user_id = ?", (user_id,))
        user_row = cursor.fetchone()
        wallet = float(user_row[0]) if user_row else 0
        referral_code = user_row[1] if user_row else ''

        cursor.execute("SELECT points, lifetime_points FROM Loyalty_Points WHERE user_id = ?", (user_id,))
        lp_row = cursor.fetchone()
        points = lp_row[0] if lp_row else 0
        lifetime_points = lp_row[1] if lp_row else 0

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
        cursor.execute("SELECT fine_amount FROM Violations WHERE violation_id = ? AND is_paid = 0", (violation_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Violation not found or already paid"}), 404
        fine = float(row[0])
        cursor.execute("SELECT wallet_balance FROM Users WHERE user_id = ?", (user_id,))
        balance = float(cursor.fetchone()[0])
        if balance < fine:
            return jsonify({"status": "error", "message": "Insufficient wallet balance"}), 400
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance - ? WHERE user_id = ?", (fine, user_id))
        cursor.execute("UPDATE Violations SET is_paid = 1 WHERE violation_id = ?", (violation_id,))
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
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT reservation_id, end_time
            FROM Reservations
            WHERE user_id = ? AND status = 'active' AND end_time < GETUTCDATE()
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
        code = f"DISC-{user_id}-{int(time.time()) % 10000}"
        cursor.execute("UPDATE Loyalty_Points SET points = points - 500 WHERE user_id = ?", (user_id,))
        cursor.execute("INSERT INTO Discounts (user_id, code, amount_off, used) VALUES (?, ?, 50.00, 0)", (user_id, code))
        cursor.execute("INSERT INTO Transactions (user_id, points_change, reason) VALUES (?, -500, ?)", (user_id, f'Redeemed for coupon {code}'))
        return jsonify({"status": "success", "code": code})
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
    if amount <= 0: return jsonify({"status": "error", "message": "Invalid amount"}), 400
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance + ? WHERE user_id = ?", (amount, user_id))
        cursor.execute("INSERT INTO Wallet_Transactions (user_id, amount, type, description) VALUES (?, ?, 'add', ?)", (user_id, amount, f'Added {amount} PKR via Digital Wallet'))
        cursor.execute("SELECT wallet_balance FROM Users WHERE user_id = ?", (user_id,))
        new_balance = float(cursor.fetchone()[0])
        return jsonify({"status": "success", "newBalance": new_balance})
    finally:
        conn.close()

# ===== BOOKINGS =====

@app.route('/api/user/<int:user_id>/bookings', methods=['GET'])
def get_bookings(user_id):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT reservation_id, spot_id, start_time, end_time, status, final_price, points_earned FROM Reservations WHERE user_id = ? ORDER BY reservation_id DESC", (user_id,))
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
        cursor.execute("""
            SELECT final_price, points_earned FROM Reservations
            WHERE reservation_id = ? AND user_id = ?
              AND status IN ('reserved', 'active')
              AND GETUTCDATE() < DATEADD(minute, 10, start_time)
        """, (reservation_id, user_id))
        row = cursor.fetchone()
        if not row: return jsonify({"status": "error", "message": "Cancellation window closed."}), 400
        refund = float(row[0])
        points_earned = int(row[1]) if row[1] else 0
        cursor.execute("UPDATE Reservations SET status = 'cancelled' WHERE reservation_id = ?", (reservation_id,))
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance + ? WHERE user_id = ?", (refund, user_id))
        cursor.execute("INSERT INTO Wallet_Transactions (user_id, amount, type, description) VALUES (?, ?, 'refund', ?)", (user_id, refund, f'Refund for cancelled reservation #{reservation_id}'))
        if points_earned > 0:
            cursor.execute("UPDATE Loyalty_Points SET points = CASE WHEN points >= ? THEN points - ? ELSE 0 END WHERE user_id = ?", (points_earned, points_earned, user_id))
            cursor.execute("INSERT INTO Transactions (user_id, points_change, reason) VALUES (?, ?, ?)", (user_id, -points_earned, f'Reversed for cancelled reservation #{reservation_id}'))
        return jsonify({"status": "success", "refund": refund})
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
    finally:
        conn.close()

@app.route('/api/parking/leave', methods=['POST'])
def check_out():
    data = request.json
    res_id = data.get('reservationId')
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT end_time, user_id, status FROM Reservations WHERE reservation_id = ?", (res_id,))
        res = cursor.fetchone()
        if not res: return jsonify({"status": "error", "message": "Not found"}), 404
        end_time, user_id, status = res[0], res[1], res[2]
        if status in ('completed', 'cancelled'): return jsonify({"status": "success"})
        cursor.execute("UPDATE Reservations SET status = 'completed' WHERE reservation_id = ? AND status = 'active'", (res_id,))
        if cursor.rowcount > 0:
            fine = overstay_fine_amount(end_time)
            if fine > 0: cursor.execute("INSERT INTO Violations (reservation_id, fine_amount, is_paid) VALUES (?, ?, 0)", (res_id, fine))
        return jsonify({"status": "success"})
    finally:
        conn.close()

# ===== LEADERBOARD =====

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT TOP 10 u.user_id, u.name, lp.points, lp.lifetime_points FROM Users u JOIN Loyalty_Points lp ON u.user_id = lp.user_id WHERE u.role != 'admin' ORDER BY lp.points DESC")
        users = [{"id": r[0], "name": r[1], "points": r[2], "lifetimePoints": r[3]} for r in cursor.fetchall()]
        cursor.execute("SELECT COUNT(*) FROM Users WHERE role != 'admin'")
        return jsonify({"leaderboard": users, "totalUsers": cursor.fetchone()[0]})
    finally:
        conn.close()

# --- ROLES HELPER ---
def is_admin(user_id):
    if not user_id: return False
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM Users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        return row and row[0] == 'admin'
    except: return False
    finally: conn.close()

# ===== ADMIN =====

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT ISNULL(SUM(final_price), 0) FROM Reservations WHERE status != 'cancelled'")
        rev = float(cursor.fetchone()[0])
        cursor.execute("SELECT COUNT(*) FROM Users")
        users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE status = 'active' AND end_time > GETUTCDATE()")
        active = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE status = 'completed'")
        completed = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE status = 'cancelled'")
        cancelled = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Reservations")
        total_bookings = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Violations")
        violations_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM Violations WHERE is_paid = 0")
        unpaid_violations = cursor.fetchone()[0]

        # Daily Revenue
        cursor.execute("SELECT CAST(created_at AS DATE), SUM(final_price) FROM Reservations WHERE status != 'cancelled' AND created_at >= DATEADD(day, -7, GETUTCDATE()) GROUP BY CAST(created_at AS DATE) ORDER BY 1")
        daily_rev = [{"day": str(r[0]), "revenue": float(r[1])} for r in cursor.fetchall()]

        # Daily Bookings
        cursor.execute("SELECT CAST(created_at AS DATE), COUNT(*) FROM Reservations WHERE created_at >= DATEADD(day, -7, GETUTCDATE()) GROUP BY CAST(created_at AS DATE) ORDER BY 1")
        daily_bookings = [{"day": str(r[0]), "count": int(r[1])} for r in cursor.fetchall()]

        # Violations List
        cursor.execute("SELECT v.violation_id, u.user_id, u.name, v.fine_amount, v.is_paid, v.created_at, v.reservation_id FROM Violations v JOIN Reservations r ON v.reservation_id = r.reservation_id JOIN Users u ON r.user_id = u.user_id ORDER BY v.created_at DESC")
        v_list = [{"id": r[0], "userId": r[1], "userName": r[2], "fineAmount": float(r[3]), "isPaid": bool(r[4]), "createdAt": str(r[5]), "reservationId": r[6]} for r in cursor.fetchall()]

        # Recent Bookings
        cursor.execute("SELECT TOP 10 r.reservation_id, u.name, r.spot_id, r.start_time, r.end_time, r.status, r.final_price FROM Reservations r JOIN Users u ON r.user_id = u.user_id ORDER BY r.created_at DESC")
        recent = [{"id": r[0], "userName": r[1], "spotId": r[2], "startTime": str(r[3]), "endTime": str(r[4]), "status": r[5], "finalPrice": float(r[6])} for r in cursor.fetchall()]

        # Zone Occupancy & Pricing State
        # First, find total active spots per zone
        cursor.execute("SELECT zone_id, COUNT(*) FROM Parking_Spots GROUP BY zone_id")
        zone_totals = {str(r[0]).strip(): r[1] for r in cursor.fetchall()}
        
        cursor.execute("SELECT zone_id, SUM(CAST(is_active AS INT)) FROM Parking_Spots GROUP BY zone_id")
        zone_online = {str(r[0]).strip(): r[1] for r in cursor.fetchall()}

        cursor.execute("""
            SELECT zone_id, COUNT(*) FROM Parking_Spots WHERE is_active = 1 GROUP BY zone_id
        """)
        zone_active_totals = {str(r[0]).strip(): r[1] for r in cursor.fetchall()}

        # Active bookings right now (distinct spots)
        cursor.execute("""
            SELECT p.zone_id, COUNT(DISTINCT r.spot_id)
            FROM Reservations r
            JOIN Parking_Spots p ON r.spot_id = p.spot_id
            WHERE p.is_active = 1
              AND r.status IN ('reserved', 'active') 
              AND r.end_time > GETUTCDATE()
            GROUP BY p.zone_id
        """)
        zone_active_counts = {str(r[0]).strip(): r[1] for r in cursor.fetchall()}

        zone_occupancy = []
        pricing_state = []
        for z in ['A', 'B', 'C']:
            total_spots = zone_totals.get(z, 0)
            active_spots = zone_active_totals.get(z, 0) or total_spots
            occupied = zone_active_counts.get(z, 0)
            online_count = zone_online.get(z, 0)
            available = max(0, active_spots - occupied)
            
            zone_occupancy.append({
                "zone": z,
                "total": total_spots,
                "occupied": occupied,
                "available": available,
                "online": online_count
            })
            
            occupancy_percent = (occupied / active_spots * 100) if active_spots > 0 else 0
            pricing_state.append({
                "zone": z,
                "occupancyPercent": int(occupancy_percent),
                "surgeActive": occupied > SURGE_OCCUPANCY_RATIO * active_spots
            })

        return jsonify({
            "totalRevenue": rev, 
            "totalUsers": users, 
            "activeBookings": active, 
            "completedBookings": completed,
            "cancelledBookings": cancelled,
            "totalBookings": total_bookings,
            "totalViolations": violations_count, 
            "unpaidViolations": unpaid_violations,
            "dailyRevenue": daily_rev, 
            "dailyBookings": daily_bookings,
            "zoneOccupancy": zone_occupancy,
            "pricingState": pricing_state,
            "violations": v_list, 
            "recentBookings": recent
        })
    finally:
        conn.close()

@app.route('/api/admin/users', methods=['GET'])
def admin_users():
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT u.user_id, u.name, u.email, u.phone, u.vehicle_plate, u.wallet_balance, u.role, ISNULL(lp.points, 0) FROM Users u LEFT JOIN Loyalty_Points lp ON u.user_id = lp.user_id ORDER BY u.created_at DESC")
        users = [{"id": r[0], "name": r[1], "email": r[2], "phone": r[3], "vehiclePlate": r[4], "walletBalance": float(r[5]), "role": r[6], "points": r[7]} for r in cursor.fetchall()]
        return jsonify({"users": users})
    finally:
        conn.close()

@app.route('/api/admin/users/<int:user_id>', methods=['PATCH'])
def update_user_admin(user_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    data = request.json
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Users SET name=?, phone=?, vehicle_plate=?, role=?, wallet_balance=? WHERE user_id=?", (data.get('name'), data.get('phone'), data.get('vehiclePlate'), data.get('role'), data.get('walletBalance'), user_id))
        if 'points' in data: cursor.execute("UPDATE Loyalty_Points SET points=? WHERE user_id=?", (data.get('points'), user_id))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user_admin(user_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Violations WHERE reservation_id IN (SELECT reservation_id FROM Reservations WHERE user_id = ?)", (user_id,))
        cursor.execute("DELETE FROM Reservations WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Loyalty_Points WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Transactions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Wallet_Transactions WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Discounts WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM Users WHERE user_id = ?", (user_id,))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/spots', methods=['POST'])
def add_spot():
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    data = request.json
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO Parking_Spots (spot_id, zone_id, is_active) VALUES (?, ?, 1)", (data.get('spotId'), data.get('zoneId')))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/spots/<spot_id>', methods=['DELETE'])
def delete_spot(spot_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Parking_Spots WHERE spot_id = ?", (spot_id,))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/spots/<spot_id>/status', methods=['PATCH'])
def toggle_spot_status(spot_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    active = 1 if request.json.get('active') else 0
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Parking_Spots SET is_active = ? WHERE spot_id = ?", (active, spot_id))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/zones/<zone_id>/status', methods=['PATCH'])
def toggle_zone_status(zone_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    active = 1 if request.json.get('active') else 0
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Parking_Spots SET is_active = ? WHERE zone_id = ?", (active, zone_id))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/bookings/<int:res_id>/force-complete', methods=['POST'])
def force_complete_booking(res_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Reservations SET status = 'completed' WHERE reservation_id = ?", (res_id,))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/violations/<int:v_id>', methods=['DELETE'])
def delete_violation(v_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Violations WHERE violation_id = ?", (v_id,))
        return jsonify({"status": "success"})
    finally:
        conn.close()

@app.route('/api/admin/violations/<int:v_id>/pay', methods=['PATCH'])
def mark_violation_paid(v_id):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id): return jsonify({"status": "error", "message": "Unauthorized"}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE Violations SET is_paid = 1 WHERE violation_id = ?", (v_id,))
        return jsonify({"status": "success"})
    finally:
        conn.close()

# ===== REPORTS =====

def _pdf_bytes(pdf):
    """fpdf2 may return str, bytearray, or bytes depending on version."""
    out = pdf.output()
    if isinstance(out, bytes):
        return out
    if isinstance(out, bytearray):
        return bytes(out)
    return out.encode('latin-1')


def _pdf_response(pdf, filename):
    return Response(
        _pdf_bytes(pdf),
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Access-Control-Expose-Headers': 'Content-Disposition',
        },
    )


def _csv_response(csv_text, filename):
    return Response(
        '\ufeff' + csv_text,
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Access-Control-Expose-Headers': 'Content-Disposition',
        },
    )


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
                FROM Users u
                LEFT JOIN Reservations r ON u.user_id = r.user_id AND r.status != 'cancelled'
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
                FROM Violations v
                JOIN Reservations r ON v.reservation_id = r.reservation_id
                ORDER BY v.created_at DESC
            """)
            for r in cursor.fetchall():
                writer.writerow([r[0], r[1], r[2], float(r[3]), r[4], str(r[5])])
        else:
            return jsonify({"status": "error", "message": "Unknown report type"}), 400

        return _csv_response(output.getvalue(), f'{report_type}_report.csv')
    finally:
        conn.close()

# --- PDF ENGINE ---

class PDF_Report(FPDF):
    def header(self):
        self.set_fill_color(30, 41, 59)
        self.rect(0, 0, 210, 35, 'F')
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, 'SMART PARKING SYSTEM', 0, 1, 'C')
        self.set_font('helvetica', '', 11)
        self.cell(0, 5, 'Professional Analytics & Infrastructure Audit', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Final Audit Report | Page {self.page_no()}', 0, 0, 'C')

@app.route('/api/reports/pdf/<report_type>', methods=['GET'])
def generate_pdf_report(report_type):
    sender_id = request.args.get('sender_id')
    if not is_admin(sender_id):
        return jsonify({"status": "error", "message": "Unauthorized. Admin access required."}), 403
    conn = get_db()
    try:
        cursor = conn.cursor()
        pdf = PDF_Report()
        pdf.add_page()
        pdf.set_font("helvetica", size=12)
        pdf.set_text_color(0, 0, 0)
        generated = False

        if report_type == 'revenue':
            generated = True
            pdf.set_font('helvetica', 'B', 14)
            pdf.cell(0, 10, "Revenue Analysis Hub", 0, 1, 'L')
            pdf.ln(5)
            cursor.execute("""
                SELECT CAST(created_at AS DATE), SUM(final_price), COUNT(*)
                FROM Reservations WHERE status != 'cancelled'
                GROUP BY CAST(created_at AS DATE) ORDER BY 1 DESC
            """)
            data = cursor.fetchall()
            if data:
                try:
                    dates = [str(r[0]) for r in reversed(data[:7])]
                    revs = [float(r[1]) for r in reversed(data[:7])]
                    plt.figure(figsize=(10, 4))
                    plt.plot(dates, revs, marker='o', color='#3b82f6', linewidth=2)
                    plt.fill_between(dates, revs, color='#3b82f6', alpha=0.1)
                    plt.title('Daily Revenue Trend (Last 7 Days)')
                    img_path = os.path.join(temp_dir, f"temp_rev_{int(time.time())}.png")
                    plt.savefig(img_path, bbox_inches='tight')
                    plt.close()
                    if os.path.isfile(img_path):
                        pdf.image(img_path, x=10, w=190)
                        pdf.ln(10)
                        try:
                            os.remove(img_path)
                        except OSError:
                            pass
                except Exception:
                    plt.close()
            pdf.set_fill_color(241, 245, 249)
            pdf.set_font('helvetica', 'B', 10)
            pdf.cell(60, 8, 'Date', 1, 0, 'C', 1)
            pdf.cell(60, 8, 'Revenue (PKR)', 1, 0, 'C', 1)
            pdf.cell(60, 8, 'Bookings', 1, 1, 'C', 1)
            pdf.set_font('helvetica', '', 10)
            for r in data:
                pdf.cell(60, 8, str(r[0]), 1, 0, 'C')
                pdf.cell(60, 8, f"{float(r[1]):,.2f}", 1, 0, 'C')
                pdf.cell(60, 8, str(r[2]), 1, 1, 'C')

        elif report_type == 'customers':
            generated = True
            pdf.set_font('helvetica', 'B', 14)
            pdf.cell(0, 10, "Customer Engagement", 0, 1, 'L')
            pdf.ln(5)
            cursor.execute("""
                SELECT u.user_id, u.name, u.email,
                    ISNULL(SUM(r.final_price), 0), COUNT(r.reservation_id)
                FROM Users u
                LEFT JOIN Reservations r ON u.user_id = r.user_id AND r.status != 'cancelled'
                GROUP BY u.user_id, u.name, u.email
                ORDER BY 4 DESC
            """)
            data = cursor.fetchall()
            pdf.set_fill_color(241, 245, 249)
            pdf.set_font('helvetica', 'B', 9)
            pdf.cell(15, 8, 'ID', 1, 0, 'C', 1)
            pdf.cell(45, 8, 'Name', 1, 0, 'C', 1)
            pdf.cell(55, 8, 'Email', 1, 0, 'C', 1)
            pdf.cell(40, 8, 'Spent (PKR)', 1, 0, 'C', 1)
            pdf.cell(35, 8, 'Bookings', 1, 1, 'C', 1)
            pdf.set_font('helvetica', '', 8)
            for r in data:
                pdf.cell(15, 8, str(r[0]), 1, 0, 'C')
                pdf.cell(45, 8, str(r[1])[:22], 1, 0, 'L')
                pdf.cell(55, 8, str(r[2])[:28], 1, 0, 'L')
                pdf.cell(40, 8, f"{float(r[3]):,.0f}", 1, 0, 'R')
                pdf.cell(35, 8, str(r[4]), 1, 1, 'C')

        elif report_type == 'violations':
            generated = True
            pdf.set_font('helvetica', 'B', 14)
            pdf.cell(0, 10, "Violation Compliance Audit", 0, 1, 'L')
            pdf.ln(5)
            cursor.execute("""
                SELECT v.violation_id, r.user_id, v.reservation_id, v.fine_amount,
                    CASE WHEN v.is_paid = 1 THEN 'Paid' ELSE 'Unpaid' END, v.created_at
                FROM Violations v
                JOIN Reservations r ON v.reservation_id = r.reservation_id
                ORDER BY v.created_at DESC
            """)
            data = cursor.fetchall()
            pdf.set_fill_color(241, 245, 249)
            pdf.set_font('helvetica', 'B', 9)
            pdf.cell(25, 8, 'Violation ID', 1, 0, 'C', 1)
            pdf.cell(25, 8, 'User ID', 1, 0, 'C', 1)
            pdf.cell(30, 8, 'Reservation', 1, 0, 'C', 1)
            pdf.cell(35, 8, 'Fine (PKR)', 1, 0, 'C', 1)
            pdf.cell(25, 8, 'Status', 1, 0, 'C', 1)
            pdf.cell(50, 8, 'Date', 1, 1, 'C', 1)
            pdf.set_font('helvetica', '', 8)
            for r in data:
                pdf.cell(25, 8, str(r[0]), 1, 0, 'C')
                pdf.cell(25, 8, str(r[1]), 1, 0, 'C')
                pdf.cell(30, 8, str(r[2]), 1, 0, 'C')
                pdf.cell(35, 8, f"{float(r[3]):,.0f}", 1, 0, 'C')
                pdf.cell(25, 8, str(r[4]), 1, 0, 'C')
                pdf.cell(50, 8, str(r[5])[:19], 1, 1, 'C')

        elif report_type == 'leaderboard':
            generated = True
            pdf.set_font('helvetica', 'B', 14)
            pdf.cell(0, 10, "Points Leaderboard", 0, 1, 'L')
            pdf.ln(5)
            cursor.execute("""
                SELECT u.user_id, u.name, lp.points, lp.lifetime_points
                FROM Users u JOIN Loyalty_Points lp ON u.user_id = lp.user_id
                ORDER BY lp.points DESC
            """)
            data = cursor.fetchall()
            pdf.set_fill_color(241, 245, 249)
            pdf.set_font('helvetica', 'B', 10)
            pdf.cell(20, 8, 'Rank', 1, 0, 'C', 1)
            pdf.cell(20, 8, 'User ID', 1, 0, 'C', 1)
            pdf.cell(70, 8, 'Name', 1, 0, 'C', 1)
            pdf.cell(40, 8, 'Points', 1, 0, 'C', 1)
            pdf.cell(40, 8, 'Lifetime', 1, 1, 'C', 1)
            pdf.set_font('helvetica', '', 9)
            for i, r in enumerate(data, 1):
                pdf.cell(20, 8, str(i), 1, 0, 'C')
                pdf.cell(20, 8, str(r[0]), 1, 0, 'C')
                pdf.cell(70, 8, str(r[1])[:32], 1, 0, 'L')
                pdf.cell(40, 8, str(r[2]), 1, 0, 'C')
                pdf.cell(40, 8, str(r[3]), 1, 1, 'C')

        if not generated:
            return jsonify({"status": "error", "message": "Unknown report type"}), 400

        return _pdf_response(pdf, f'{report_type}_report.pdf')
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
