-- 1. Create Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SmartParkingDB')
BEGIN
    CREATE DATABASE SmartParkingDB;
END
GO

USE SmartParkingDB;
GO

PRINT '--- RESETTING DATABASE STARTED ---';

-- ====================================================================
-- 0. Clean Up (Order matters for Foreign Keys!)
-- ====================================================================
DROP FUNCTION IF EXISTS dbo.GetDynamicRate;
DROP TABLE IF EXISTS Wallet_Transactions;
DROP TABLE IF EXISTS Discounts;
DROP TABLE IF EXISTS Transactions;
DROP TABLE IF EXISTS Loyalty_Points;
DROP TABLE IF EXISTS Violations;
DROP TABLE IF EXISTS Reservations;
DROP TABLE IF EXISTS Parking_Spots;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Vehicle_Types;
GO

PRINT '--- TABLES DROPPED ---';


-- 2.1 Vehicle_Types
CREATE TABLE Vehicle_Types (
    type_id INT IDENTITY PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    base_rate DECIMAL(10,2) NOT NULL
);
GO

-- 2.2 Users
CREATE TABLE Users (
    user_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(150) UNIQUE NOT NULL,
    phone NVARCHAR(20) NULL,
    vehicle_plate NVARCHAR(20) UNIQUE NULL,   
    vehicle_type_id INT FOREIGN KEY REFERENCES Vehicle_Types(type_id),
    password NVARCHAR(255) NOT NULL,          
    wallet_balance DECIMAL(10,2) DEFAULT 0,
    referral_code NVARCHAR(20) UNIQUE NULL,
    role NVARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','admin')),
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 2.3 Parking_Spots
CREATE TABLE Parking_Spots (
    spot_id NVARCHAR(10) PRIMARY KEY,
    zone_id CHAR(1) NOT NULL,
    is_active BIT DEFAULT 1
);
GO

-- 2.4 Reservations
CREATE TABLE Reservations (
    reservation_id INT IDENTITY PRIMARY KEY,
    user_id INT FOREIGN KEY REFERENCES Users(user_id),
    spot_id NVARCHAR(10) FOREIGN KEY REFERENCES Parking_Spots(spot_id),
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
    original_price DECIMAL(10,2) NULL,
    discount_applied DECIMAL(10,2) DEFAULT 0,
    final_price DECIMAL(10,2) NULL,
    points_earned INT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    CHECK (end_time > start_time)
);
GO

-- 2.5 Violations
CREATE TABLE Violations (
    violation_id INT IDENTITY PRIMARY KEY,
    reservation_id INT FOREIGN KEY REFERENCES Reservations(reservation_id),
    fine_amount DECIMAL(10,2) NOT NULL,
    is_paid BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 2.6 Loyalty_Points
CREATE TABLE Loyalty_Points (
    user_id INT PRIMARY KEY FOREIGN KEY REFERENCES Users(user_id),
    points INT DEFAULT 0,
    lifetime_points INT DEFAULT 0
);
GO

-- 2.7 Transactions (point transaction log)
CREATE TABLE Transactions (
    transaction_id INT IDENTITY PRIMARY KEY,
    user_id INT FOREIGN KEY REFERENCES Users(user_id),
    points_change INT NOT NULL,
    reason NVARCHAR(255) NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 2.8 Discounts
CREATE TABLE Discounts (
    discount_id INT IDENTITY PRIMARY KEY,
    user_id INT FOREIGN KEY REFERENCES Users(user_id),
    code NVARCHAR(50) UNIQUE NOT NULL,
    amount_off DECIMAL(10,2) NOT NULL,
    used BIT DEFAULT 0,
    expires_at DATETIME NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 2.9 Wallet_Transactions
CREATE TABLE Wallet_Transactions (
    trans_id INT IDENTITY PRIMARY KEY,
    user_id INT FOREIGN KEY REFERENCES Users(user_id),
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('add','book','fine','refund')),
    description NVARCHAR(255) NULL,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- ====================================================================
-- 3. Sample Data
-- ====================================================================

-- ====================================================================
-- 3. Sample Data (Rich Dataset for Presentation)
-- ====================================================================

-- 3.1 Vehicle_Types
INSERT INTO Vehicle_Types (name, base_rate) VALUES
('Bike', 40.00),
('Car', 80.00),
('SUV', 120.00);
GO

-- 3.2 Parking_Spots
-- 30 Total Spots
INSERT INTO Parking_Spots (spot_id, zone_id, is_active) VALUES
('A01','A', 1),('A02','A', 1),('A03','A', 0),('A04','A', 1),('A05','A', 0),
('A06','A', 1),('A07','A', 1),('A08','A', 1),('A09','A', 1),('A10','A', 1),
('B01','B', 1),('B02','B', 0),('B03','B', 1),('B04','B', 1),('B05','B', 1),
('B06','B', 1),('B07','B', 1),('B08','B', 1),('B09','B', 1),('B10','B', 1),
('C01','C', 1),('C02','C', 1),('C03','C', 1),('C04','C', 1),('C05','C', 1),
('C06','C', 1),('C07','C', 0),('C08','C', 1),('C09','C', 1),('C10','C', 1);
GO

-- 3.3 Users
-- Passwords: 'admin123' for admin, 'user123' for others
INSERT INTO Users (name, email, phone, vehicle_plate, vehicle_type_id, password, wallet_balance, referral_code, role)
VALUES
('Admin Center', 'admin@example.com', '03001112222', 'ADMIN-001', 2, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'admin123'), 2), 5000.00, 'ADMINSHIELD', 'admin'),
('Ali Khan', 'ali@example.com', '03003334444', 'LEA-555', 2, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 450.00, 'ALIKH_99', 'user'),
('Sara Ahmed', 'sara@example.com', '03005556666', 'KHI-123', 2, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 1200.00, 'SARA_42', 'user'),
('Zain Malik', 'zain@example.com', '03007778888', 'LHR-999', 3, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 80.00, 'ZAIN_XT', 'user'),
('Fatima Noor', 'fatima@example.com', '03009990000', 'ISL-786', 1, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 2500.00, 'FATIM_07', 'user'),
('Hamza Sheikh', 'hamza@example.com', '03001230001', 'GUJ-111', 2, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 300.00, 'HAMZA_01', 'user'),
('Bilal Javed', 'bilal@example.com', '03001230002', 'MUL-222', 2, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 150.00, 'BILAL_02', 'user'),
('Ayesha Malik', 'ayesha@example.com', '03001230003', 'FSD-333', 1, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 900.00, 'AYESH_03', 'user'),
('Usman Tariq', 'usman@example.com', '03001230004', 'PES-444', 3, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 600.00, 'USMAN_04', 'user'),
('Mariam Bibi', 'mariam@example.com', '03001230005', 'QUET-555', 2, CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', 'user123'), 2), 400.00, 'MARIA_05', 'user');
GO

-- 3.4 Loyalty_Points
INSERT INTO Loyalty_Points (user_id, points, lifetime_points) VALUES
(1, 1500, 5000), (2, 450, 1200), (3, 890, 2500), (4, 120, 500), (5, 2100, 3000),
(6, 300, 600), (7, 150, 300), (8, 900, 1500), (9, 600, 1000), (10, 400, 800);
GO

-- 3.5 Reservations
-- UPDATED ZONAL DISTRIBUTION: 4 in Zone A, 6 in Zone B, 3 in Zone C
INSERT INTO Reservations (user_id, spot_id, start_time, end_time, status, final_price, points_earned, created_at)
VALUES
-- Zone A (7 Active - Surge Triggered)
(1, 'A01', DATEADD(MINUTE, -30, GETUTCDATE()), DATEADD(HOUR, 2, GETUTCDATE()), 'active', 160.00, 1600, GETUTCDATE()),
(2, 'A02', DATEADD(MINUTE, -45, GETUTCDATE()), DATEADD(HOUR, 4, GETUTCDATE()), 'active', 320.00, 3200, GETUTCDATE()),
(3, 'A04', DATEADD(HOUR, -1, GETUTCDATE()), DATEADD(HOUR, 3, GETUTCDATE()), 'active', 400.00, 4000, GETUTCDATE()),
(4, 'A06', DATEADD(HOUR, -2, GETUTCDATE()), DATEADD(HOUR, 5, GETUTCDATE()), 'active', 480.00, 4800, GETUTCDATE()),
(5, 'A07', DATEADD(HOUR, -1, GETUTCDATE()), DATEADD(HOUR, 4, GETUTCDATE()), 'active', 320.00, 3200, GETUTCDATE()),
(6, 'A08', DATEADD(MINUTE, -10, GETUTCDATE()), DATEADD(HOUR, 2, GETUTCDATE()), 'active', 160.00, 1600, GETUTCDATE()),
(7, 'A09', DATEADD(MINUTE, -5, GETUTCDATE()), DATEADD(HOUR, 3, GETUTCDATE()), 'active', 240.00, 2400, GETUTCDATE()),

-- Zone B (6 Active)
(5, 'B01', DATEADD(MINUTE, -15, GETUTCDATE()), DATEADD(HOUR, 2, GETUTCDATE()), 'active', 240.00, 2400, GETUTCDATE()),
(6, 'B03', DATEADD(HOUR, -1, GETUTCDATE()), DATEADD(HOUR, 4, GETUTCDATE()), 'active', 300.00, 3000, GETUTCDATE()),
(7, 'B05', DATEADD(MINUTE, -40, GETUTCDATE()), DATEADD(HOUR, 3, GETUTCDATE()), 'active', 150.00, 1500, GETUTCDATE()),
(8, 'B07', DATEADD(HOUR, -2, GETUTCDATE()), DATEADD(HOUR, 1, GETUTCDATE()), 'active', 320.00, 3200, GETUTCDATE()),
(9, 'B08', DATEADD(MINUTE, -10, GETUTCDATE()), DATEADD(HOUR, 6, GETUTCDATE()), 'active', 560.00, 5600, GETUTCDATE()),
(10, 'B10', DATEADD(HOUR, -1, GETUTCDATE()), DATEADD(HOUR, 2, GETUTCDATE()), 'active', 320.00, 3200, GETUTCDATE()),

-- Zone C (3 Active)
(2, 'C01', DATEADD(MINUTE, -50, GETUTCDATE()), DATEADD(HOUR, 4, GETUTCDATE()), 'active', 360.00, 3600, GETUTCDATE()),
(3, 'C03', DATEADD(HOUR, -1, GETUTCDATE()), DATEADD(HOUR, 3, GETUTCDATE()), 'active', 120.00, 1200, GETUTCDATE()),
(5, 'C05', DATEADD(MINUTE, -20, GETUTCDATE()), DATEADD(HOUR, 1, GETUTCDATE()), 'active', 240.00, 2400, GETUTCDATE()),

-- Past Records for Analytics
(4, 'C08', DATEADD(DAY, -2, GETUTCDATE()), DATEADD(DAY, -2, DATEADD(HOUR, 2, GETUTCDATE())), 'completed', 160.00, 1600, GETUTCDATE()),
(1, 'B04', DATEADD(DAY, -3, GETUTCDATE()), DATEADD(DAY, -3, DATEADD(HOUR, 5, GETUTCDATE())), 'cancelled', 400.00, 0, GETUTCDATE());
GO

PRINT '--- 10 USERS AND ZONAL DATA INSERTED ---';


-- 3.6 Violations
INSERT INTO Violations (reservation_id, fine_amount, is_paid, created_at)
VALUES
(4, 250.00, 1, DATEADD(DAY, -1, GETUTCDATE())),
(5, 500.00, 0, GETUTCDATE());
GO

-- 3.7 Wallet_Transactions
INSERT INTO Wallet_Transactions (user_id, amount, type, description, created_at)
VALUES
(2, 500.00, 'add', 'Wallet Top-up via Credit Card', DATEADD(DAY, -2, GETUTCDATE())),
(2, 160.00, 'book', 'Booking spot A01', DATEADD(DAY, -1, GETUTCDATE())),
(3, 1000.00, 'add', 'Promotional Balance Added', DATEADD(DAY, -1, GETUTCDATE())),
(5, 2500.00, 'add', 'Initial Deposit', DATEADD(DAY, -5, GETUTCDATE()));
GO

-- ====================================================================
-- 4. Dynamic Pricing Function
-- ====================================================================
CREATE FUNCTION dbo.GetDynamicRate(
    @zone CHAR(1),
    @start DATETIME,
    @end DATETIME,
    @vehicle INT
)
RETURNS DECIMAL(10,2)
AS
BEGIN
    DECLARE @base DECIMAL(10,2);
    
    SELECT @base = base_rate FROM Vehicle_Types WHERE type_id = @vehicle;
    
    RETURN @base * 
        CASE 
            WHEN (
                SELECT COUNT(DISTINCT r.spot_id)
                FROM Reservations r
                JOIN Parking_Spots p ON r.spot_id = p.spot_id
                WHERE p.zone_id = @zone
                  AND r.status = 'active'
                  AND r.start_time < @end
                  AND r.end_time > @start
            ) > 0.8 * (SELECT COUNT(*) FROM Parking_Spots WHERE zone_id = @zone AND is_active = 1)
            THEN 1.2
            ELSE 1.0
        END;
END;
GO

-- ====================================================================
-- 5. Test
-- ====================================================================
SELECT dbo.GetDynamicRate('A', GETDATE(), DATEADD(hour, 2, GETDATE()), 2) AS TestRate;
GO

select * from USERS;