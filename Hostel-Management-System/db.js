// db.js
// Simulated Relational Database Engine using localStorage

const DB = {
    init: function() {
        if (!localStorage.getItem('nexus_users')) {
            const users = [
                { id: 'ADM-001', role: 'admin', name: 'System Administrator', email: 'admin@nexus.edu', contact: '9999999999', password: 'admin', room: null, status: 'Active' },
                { id: 'STU-001', role: 'student', name: 'John Doe', email: 'john@nexus.edu', contact: '8888888888', password: 'password', room: 'A101', status: 'Paid' },
                { id: 'STU-002', role: 'student', name: 'Jane Smith', email: 'jane@nexus.edu', contact: '7777777777', password: 'password', room: 'B205', status: 'Pending' }
            ];
            localStorage.setItem('nexus_users', JSON.stringify(users));
        }

        if (!localStorage.getItem('nexus_rooms')) {
            const rooms = [
                'A101', 'A102', 'A103', 'A104', 'A105', 'A201', 'A202', 'A203', 'A204', 'A205',
                'B101', 'B102', 'B103', 'B104', 'B105', 'B201', 'B202', 'B203', 'B204', 'B205'
            ];
            localStorage.setItem('nexus_rooms', JSON.stringify(rooms));
        }

        if (!localStorage.getItem('nexus_complaints')) {
            localStorage.setItem('nexus_complaints', JSON.stringify([
                { id: 'CMP-001', studentId: 'STU-001', subject: 'A/C Not Cooling', description: 'The AC unit in A101 is not cooling effectively since yesterday.', status: 'Open', date: '10/24/2026' }
            ]));
        }

        if (!localStorage.getItem('nexus_gatepasses')) {
            localStorage.setItem('nexus_gatepasses', JSON.stringify([
                { id: 'GP-001', studentId: 'STU-002', reason: 'Family Function Visit', outDate: '2026-10-25', inDate: '2026-10-28', status: 'Pending' }
            ]));
        }

        if (!localStorage.getItem('nexus_notices')) {
            localStorage.setItem('nexus_notices', JSON.stringify([
                { title: 'Semester Maintenance Schedule', content: 'Routine electrical maintenance will occur this weekend in Block A.', date: '10/22/2026', author: 'System Administrator' }
            ]));
        }

        if (!localStorage.getItem('nexus_payments')) {
            localStorage.setItem('nexus_payments', JSON.stringify([
                { id: 'TXN-001', studentId: 'STU-001', amount: 1500, date: '10/01/2026' }
            ]));
        }

        if (!localStorage.getItem('nexus_settings')) {
            localStorage.setItem('nexus_settings', JSON.stringify({ hostelName: 'NEXUS RESIDENCY' }));
        }

        if (!localStorage.getItem('nexus_mess_optouts')) {
            localStorage.setItem('nexus_mess_optouts', JSON.stringify([])); // Array of Student IDs opted out for upcoming weekend
        }

        if (!localStorage.getItem('nexus_attendance')) {
            localStorage.setItem('nexus_attendance', JSON.stringify([])); // {date, studentId, status: present/absent}
        }
    },

    getCollection: function(name) {
        return JSON.parse(localStorage.getItem(name)) || [];
    },

    setCollection: function(name, data) {
        localStorage.setItem(name, JSON.stringify(data));
    },

    generateId: function(prefix) {
        return prefix + '-' + Math.floor(Math.random() * 90000 + 10000);
    },

    login: function(identifier, password) {
        const users = this.getCollection('nexus_users');
        const user = users.find(u => (u.email === identifier || u.contact === identifier) && u.password === password);
        if (user) {
            localStorage.setItem('nexus_session', JSON.stringify(user));
            return user;
        }
        return null;
    },

    logout: function() {
        localStorage.removeItem('nexus_session');
        window.location.href = 'login.html';
    },

    getCurrentUser: function() {
        return JSON.parse(localStorage.getItem('nexus_session'));
    },

    checkAuth: function(requiredRole) {
        const user = this.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return null;
        }
        if (requiredRole && user.role !== requiredRole) {
            window.location.href = 'login.html';
            return null;
        }
        return user;
    },

    // --- SUPER FEATURES LOGIC --- //

    // 1. Mess Opt-Out Toggle
    toggleMessOptOut: function(studentId) {
        let optouts = this.getCollection('nexus_mess_optouts');
        if (optouts.includes(studentId)) {
            optouts = optouts.filter(id => id !== studentId); // Remove
            this.setCollection('nexus_mess_optouts', optouts);
            return false;
        } else {
            optouts.push(studentId); // Add
            this.setCollection('nexus_mess_optouts', optouts);
            return true;
        }
    },
    
    isOptedOut: function(studentId) {
        return this.getCollection('nexus_mess_optouts').includes(studentId);
    },

    // 2. Trigger Automated Billing Cycle
    triggerMonthlyBilling: function(amount = 1500) {
        let users = this.getCollection('nexus_users');
        let payments = this.getCollection('nexus_payments');
        let count = 0;
        const date = new Date().toLocaleDateString();

        users = users.map(user => {
            if (user.role === 'student' && user.room) {
                user.status = 'Pending';
                payments.push({ id: this.generateId('TXN'), studentId: user.id, amount: amount, date: date });
                count++;
            }
            return user;
        });

        this.setCollection('nexus_users', users);
        this.setCollection('nexus_payments', payments);
        return count;
    },

    // 3. Nightly Attendance Operations
    markAttendance: function(studentId, statusStr) {
        let attendance = this.getCollection('nexus_attendance');
        const today = new Date().toLocaleDateString();
        
        // Remove existing record for today if exists
        attendance = attendance.filter(a => !(a.studentId === studentId && a.date === today));
        
        attendance.push({ date: today, studentId: studentId, status: statusStr });
        this.setCollection('nexus_attendance', attendance);
    },

    getTodayAttendance: function(studentId) {
        const today = new Date().toLocaleDateString();
        const records = this.getCollection('nexus_attendance');
        const record = records.find(a => a.studentId === studentId && a.date === today);
        return record ? record.status : 'Unmarked';
    }
};

DB.init();
