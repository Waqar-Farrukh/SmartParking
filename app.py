import pyodbc
import hashlib
import time
import csv
import io
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
                "SELECT user_id, name, email, wallet_balance, referral_code, role FROM Users WHERE email = ? AND password = ?",
                (email, h_pass)
            )
        except:
            cursor.execute(
                "SELECT user_id, name, email, wallet_balance, referral_code FROM Users WHERE email = ? AND password = ?",
                (email, h_pass)
            )
        user = cursor.fetchone()
        if user:
            role = user[5] if len(user) > 5 else 'user'
            return jsonify({
                "status": "success",
                "user": {
                    "id": user[0],
                    "name": user[1],
                    "email": user[2],
                    "wallet_balance": float(user[3]),
                    "referral_code": user[4],
                    "role": role
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
            if r[2] == 0:
                status = "unavailable"
            elif r[0] in occupied:
                status = "occupied"
            else:
                status = "available"
            spots.append({"id": r[0], "zone": r[1], "status": status})
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
            WHERE spot_id = ? AND status = 'active'
            AND start_time < ? AND end_time > ?
        """, (spot_id, end, start))
        if cursor.fetchone()[0] > 0:
            return jsonify({"status": "error", "message": "Spot is already booked for this time period."}), 400

        # Get zone from spot_id
        cursor.execute("SELECT zone_id FROM Parking_Spots WHERE spot_id = ?", (spot_id,))
        zone_row = cursor.fetchone()
        zone = zone_row[0] if zone_row else 'A'

        cursor.execute("SELECT vehicle_type_id FROM Users WHERE user_id = ?", (user_id,))
        v_type = cursor.fetchone()[0]

        rate = cursor.execute("SELECT dbo.GetDynamicRate(?, ?, ?, ?)", (zone, start, end, v_type)).fetchval()
        final_price = float(rate) if rate else 80.0
        points_earned = int(final_price * 10)

        # Check wallet balance
        cursor.execute("SELECT wallet_balance FROM Users WHERE user_id = ?", (user_id,))
        balance = float(cursor.fetchone()[0])
        if balance < final_price:
            return jsonify({"status": "error", "message": f"Insufficient wallet balance. Need {final_price} PKR, have {balance} PKR."}), 400

        # Deduct from wallet
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance - ? WHERE user_id = ?", (final_price, user_id))

        # Create reservation
        cursor.execute(
            "INSERT INTO Reservations (user_id, spot_id, start_time, end_time, status, final_price, points_earned) VALUES (?, ?, ?, ?, 'active', ?, ?)",
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
                "startTime": r[2].isoformat() if r[2] else '',
                "endTime": r[3].isoformat() if r[3] else '',
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
        for r in expired:
            res_id = r[0]
            # Check if violation already exists
            cursor.execute("SELECT COUNT(*) FROM Violations WHERE reservation_id = ?", (res_id,))
            if cursor.fetchone()[0] == 0:
                # Calculate fine: 100 base + 50/hr overstay
                end_time = r[1]
                from datetime import datetime
                hours_over = max(1, int((datetime.now() - end_time).total_seconds() / 3600))
                fine = 100 + (50 * hours_over)
                cursor.execute(
                    "INSERT INTO Violations (reservation_id, fine_amount, is_paid) VALUES (?, ?, 0)",
                    (res_id, fine)
                )
                created += 1

            # Mark reservation as completed
            cursor.execute("UPDATE Reservations SET status = 'completed' WHERE reservation_id = ?", (res_id,))

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
                "startTime": r[2].isoformat() if r[2] else '',
                "endTime": r[3].isoformat() if r[3] else '',
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
            "SELECT final_price, status FROM Reservations WHERE reservation_id = ? AND user_id = ?",
            (reservation_id, user_id)
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "Reservation not found"}), 404
        if row[1] != 'active':
            return jsonify({"status": "error", "message": "Only active reservations can be cancelled"}), 400

        refund = float(row[0])

        # Cancel reservation
        cursor.execute("UPDATE Reservations SET status = 'cancelled' WHERE reservation_id = ?", (reservation_id,))

        # Refund wallet
        cursor.execute("UPDATE Users SET wallet_balance = wallet_balance + ? WHERE user_id = ?", (refund, user_id))

        # Log wallet transaction
        cursor.execute(
            "INSERT INTO Wallet_Transactions (user_id, amount, type, description) VALUES (?, ?, 'refund', ?)",
            (user_id, refund, f'Refund for cancelled reservation #{reservation_id}')
        )

        return jsonify({"status": "success", "refund": refund})
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

        # Get total count
        cursor.execute("SELECT COUNT(*) FROM Users")
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

        # Total revenue
        cursor.execute("SELECT ISNULL(SUM(final_price), 0) FROM Reservations WHERE status != 'cancelled'")
        total_revenue = float(cursor.fetchone()[0])

        # Total users
        cursor.execute("SELECT COUNT(*) FROM Users")
        total_users = cursor.fetchone()[0]

        # Active bookings
        cursor.execute("SELECT COUNT(*) FROM Reservations WHERE status = 'active'")
        active_bookings = cursor.fetchone()[0]

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

        # Zone occupancy
        zone_occupancy = []
        for zone_id in ['A', 'B', 'C']:
            cursor.execute("SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ? AND is_active = 1", (zone_id,))
            total_in_zone = cursor.fetchone()[0]
            cursor.execute("""
                SELECT COUNT(DISTINCT spot_id) FROM Reservations 
                WHERE spot_id IN (SELECT spot_id FROM Parking_Spots WHERE zone_id = ?)
                AND status = 'active' AND end_time > GETUTCDATE()
            """, (zone_id,))
            occupied_in_zone = cursor.fetchone()[0]
            zone_occupancy.append({
                "zone": zone_id,
                "total": total_in_zone,
                "occupied": occupied_in_zone,
                "available": total_in_zone - occupied_in_zone
            })

        # Dynamic pricing state per zone
        pricing_state = []
        for zone_id in ['A', 'B', 'C']:
            cursor.execute("SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = ? AND is_active = 1", (zone_id,))
            total_spots = cursor.fetchone()[0]
            cursor.execute("""
                SELECT COUNT(DISTINCT spot_id) FROM Reservations 
                WHERE spot_id IN (SELECT spot_id FROM Parking_Spots WHERE zone_id = ?)
                AND status = 'active' AND end_time > GETUTCDATE()
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
            SELECT v.violation_id, r.user_id, v.reservation_id, v.fine_amount, v.is_paid, v.created_at
            FROM Violations v
            JOIN Reservations r ON v.reservation_id = r.reservation_id
            ORDER BY v.created_at DESC
        """)
        violations = []
        for r in cursor.fetchall():
            violations.append({
                "id": r[0],
                "userId": r[1],
                "reservationId": r[2],
                "fineAmount": float(r[3]),
                "isPaid": bool(r[4]),
                "createdAt": r[5].isoformat() if r[5] else ''
            })

        # Recent reservations for admin
        cursor.execute("""
            SELECT TOP 10 r.reservation_id, u.name, r.spot_id, r.start_time, r.end_time, r.status, r.final_price, r.created_at
            FROM Reservations r JOIN Users u ON r.user_id = u.user_id
            ORDER BY r.created_at DESC
        """)
        recent_bookings = []
        for r in cursor.fetchall():
            recent_bookings.append({
                "id": r[0],
                "userName": r[1],
                "spotId": r[2],
                "startTime": r[3].isoformat() if r[3] else '',
                "endTime": r[4].isoformat() if r[4] else '',
                "status": r[5],
                "finalPrice": float(r[6]) if r[6] else 0,
                "createdAt": r[7].isoformat() if r[7] else ''
            })

        return jsonify({
            "totalRevenue": total_revenue,
            "totalUsers": total_users,
            "activeBookings": active_bookings,
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
                       (SELECT COUNT(*) FROM Reservations WHERE user_id = u.user_id) as total_bookings
                FROM Users u
                LEFT JOIN Loyalty_Points lp ON u.user_id = lp.user_id
                ORDER BY u.created_at DESC
            """)
        except:
            cursor.execute("""
                SELECT u.user_id, u.name, u.email, u.phone, u.vehicle_plate, u.wallet_balance, u.referral_code, 'user' as role, u.created_at,
                       ISNULL(lp.points, 0) as points, ISNULL(lp.lifetime_points, 0) as lifetime_points,
                       (SELECT COUNT(*) FROM Reservations WHERE user_id = u.user_id) as total_bookings
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
                "createdAt": r[8].isoformat() if r[8] else '',
                "points": r[9],
                "lifetimePoints": r[10],
                "totalBookings": r[11]
            })
        return jsonify({"users": users, "totalCount": len(users)})
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
