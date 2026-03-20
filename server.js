const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
// Serve frontend static files (HTML, CSS, JS) from project root
app.use(express.static(path.join(__dirname)));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/garbage-system', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

// Models (single-file export `models.js`)
const { User, Complaint, Task, SmartBin } = require('./models');

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Smart Garbage Collection System API' });
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            role: role || 'citizen'
        });
        
        await user.save();
        
        // Generate token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        // Find user
        const user = await User.findOne({ email, role });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Worker login
app.post('/api/auth/worker-login', async (req, res) => {
    try {
        const { employeeId, pin } = req.body;
        
        // Find worker
        const worker = await User.findOne({ employeeId, role: 'worker' });
        if (!worker) {
            return res.status(401).json({ error: 'Invalid employee ID' });
        }
        
        // Check PIN (in real app, use proper encryption)
        if (worker.pin !== pin) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }
        
        // Generate token
        const token = jwt.sign(
            { userId: worker._id, role: worker.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1d' }
        );
        
        res.json({
            message: 'Worker login successful',
            token,
            user: {
                id: worker._id,
                name: worker.name,
                employeeId: worker.employeeId,
                role: worker.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Complaint routes
const upload = multer({ dest: 'uploads/' });

app.post('/api/complaints', upload.single('photo'), async (req, res) => {
    try {
        const { userId, issueType, location, description, severity, anonymous } = req.body;
        
        const complaint = new Complaint({
            userId: anonymous ? null : userId,
            issueType,
            location: JSON.parse(location),
            description,
            severity: severity || 'medium',
            photo: req.file ? req.file.path : null,
            status: 'pending'
        });
        
        await complaint.save();
        
        // AI Processing simulation
        setTimeout(async () => {
            complaint.aiVerified = true;
            complaint.severity = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
            await complaint.save();
        }, 2000);
        
        res.status(201).json({
            message: 'Complaint submitted successfully',
            complaintId: complaint._id,
            complaint
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/complaints', async (req, res) => {
    try {
        const { userId, status, fromDate, toDate } = req.query;
        let query = {};
        
        if (userId) query.userId = userId;
        if (status) query.status = status;
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }
        
        const complaints = await Complaint.find(query)
            .populate('userId', 'name email phone')
            .sort({ createdAt: -1 });
        
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Task routes
app.get('/api/tasks', async (req, res) => {
    try {
        const { workerId, status } = req.query;
        let query = {};
        
        if (workerId) query.workerId = workerId;
        if (status) query.status = status;
        
        const tasks = await Task.find(query)
            .populate('complaintId')
            .populate('workerId', 'name employeeId')
            .sort({ priority: -1, createdAt: -1 });
        
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/assign', async (req, res) => {
    try {
        const { complaintId, workerId, priority } = req.body;
        
        const task = new Task({
            complaintId,
            workerId,
            priority: priority || 'medium',
            status: 'assigned'
        });
        
        await task.save();
        
        // Update complaint status
        await Complaint.findByIdAndUpdate(complaintId, { status: 'assigned' });
        
        res.status(201).json({
            message: 'Task assigned successfully',
            task
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Smart Bin routes
app.get('/api/smart-bins', async (req, res) => {
    try {
        const { location, status } = req.query;
        let query = {};
        
        if (location) {
            const [lat, lng, radius] = location.split(',');
            query.location = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: radius || 5000 // 5km default
                }
            };
        }
        if (status) query.status = status;
        
        const bins = await SmartBin.find(query);
        res.json(bins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analytics routes
app.get('/api/analytics/dashboard', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const totalComplaints = await Complaint.countDocuments();
        const todayComplaints = await Complaint.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });
        const completedComplaints = await Complaint.countDocuments({ status: 'completed' });
        
        const activeWorkers = await User.countDocuments({ 
            role: 'worker', 
            shiftStatus: 'active' 
        });
        
        const complaintsByType = await Complaint.aggregate([
            { $group: { _id: '$issueType', count: { $sum: 1 } } }
        ]);
        
        const complaintsBySeverity = await Complaint.aggregate([
            { $group: { _id: '$severity', count: { $sum: 1 } } }
        ]);
        
        res.json({
            totalComplaints,
            todayComplaints,
            pendingComplaints,
            completedComplaints,
            activeWorkers,
            complaintsByType,
            complaintsBySeverity,
            resolutionRate: totalComplaints > 0 ? 
                (completedComplaints / totalComplaints * 100).toFixed(2) : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});