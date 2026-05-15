-- RUN THIS IN SQL SERVER MANAGEMENT STUDIO (SSMS) TO FIX ADMIN ROLES
USE SmartParkingDB;
GO

-- 1. Ensure the role column exists
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = N'role')
BEGIN
    ALTER TABLE Users ADD role NVARCHAR(20) DEFAULT 'user';
END
GO

-- 2. Update the default admin user to have the admin role
-- Replace with the actual email you are using for testing if different
UPDATE Users SET role = 'admin' WHERE email = 'admin@example.com';
GO

-- 3. Make some spots inactive for demonstration (will show as Blue/Offline in UI)
UPDATE Parking_Spots SET is_active = 0 WHERE spot_id IN ('A03', 'A05', 'B02', 'C07');
GO

-- 4. Verify user roles
SELECT user_id, name, email, role FROM Users;
GO
