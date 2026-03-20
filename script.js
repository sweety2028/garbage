// ===== GLOBAL VARIABLES =====
let currentUser = null;
let currentRole = 'citizen';
let currentMenu = 'report';
let map = null;
let markers = [];

// ===== DATA STRUCTURES =====
const menuStructures = {
    citizen: {
        title: "Citizen Options",
        icon: "fas fa-user",
        items: [
            { id: "report", name: "Report Garbage", icon: "fas fa-plus-circle" },
            { id: "track", name: "Track Status", icon: "fas fa-map-marked-alt" },
            { id: "notifications", name: "Notifications", icon: "fas fa-bell" },
            { id: "history", name: "Complaint History", icon: "fas fa-history" },
            { id: "smart_bins", name: "Smart Dustbin Status", icon: "fas fa-trash" }
        ]
    },
    worker: {
        title: "Worker Options",
        icon: "fas fa-hard-hat",
        items: [
            { id: "shift", name: "Start/End Shift", icon: "fas fa-clock" },
            { id: "tasks", name: "Assigned Tasks", icon: "fas fa-tasks" },
            { id: "update", name: "Update Task Status", icon: "fas fa-edit" },
            { id: "gps", name: "Live GPS Tracking", icon: "fas fa-satellite" },
            { id: "route", name: "Optimized Route", icon: "fas fa-route" }
        ]
    },
    admin: {
        title: "Admin Dashboard",
        icon: "fas fa-tachometer-alt",
        items: [
            { id: "dashboard", name: "Dashboard Overview", icon: "fas fa-chart-line" },
            { id: "assign", name: "Assign Collector", icon: "fas fa-user-check" },
            { id: "analytics", name: "Analytics & Reports", icon: "fas fa-chart-bar" },
            { id: "monitoring", name: "Smart Dustbin Monitoring", icon: "fas fa-desktop" },
            { id: "workers", name: "Worker Management", icon: "fas fa-users-cog" },
            { id: "hotspots", name: "Garbage Hotspots", icon: "fas fa-fire" }
        ]
    },
    ai: {
        title: "AI Functions",
        icon: "fas fa-robot",
        items: [
            { id: "image_verify", name: "Image Verification", icon: "fas fa-camera" },
            { id: "severity", name: "Severity Detection", icon: "fas fa-exclamation-triangle" },
            { id: "route_opt", name: "Route Optimization", icon: "fas fa-route" },
            { id: "hotspot_detect", name: "Hotspot Detection", icon: "fas fa-map-marker-alt" },
            { id: "predictive", name: "Predictive Analytics", icon: "fas fa-brain" },
            { id: "efficiency", name: "Efficiency Analysis", icon: "fas fa-chart-pie" }
        ]
    }
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkLoginStatus();
});

function initializeApp() {
    // Initialize map if needed
    if (document.getElementById('map')) {
        initMap();
    }
    // Fetch public data from Firebase (if configured)
    if (window.db) {
        fetchFirebasePublicData();
    } else {
        // Try again shortly if Firebase wasn't ready at DOMContentLoaded
        setTimeout(() => { if (window.db) fetchFirebasePublicData(); }, 1000);
    }
    // Load default role
    loadRole(currentRole);
}

// ===== Firebase integration =====
/**
 * Fetches documents from Firestore collection `publicData` and renders
 * them into `#firebaseDataList`. Expects `window.db` to be a Firestore instance.
 */
function fetchFirebasePublicData() {
    const container = document.getElementById('firebaseDataList');
    if (!container) return;
    container.textContent = 'Loading public data from Firebase...';
    // Prefer the modular `getFirebasePublicDocs()` exposed by the module initializer.
    if (typeof window.getFirebasePublicDocs === 'function') {
        window.getFirebasePublicDocs()
            .then(docs => {
                if (!docs || docs.length === 0) {
                    container.innerHTML = '<p>No public data available.</p>';
                    return;
                }

                const list = document.createElement('div');
                list.style.display = 'grid';
                list.style.gridGap = '8px';

                docs.forEach(doc => {
                    const item = document.createElement('div');
                    item.className = 'firebase-item';
                    item.style.padding = '8px';
                    item.style.border = '1px solid #eee';
                    item.style.borderRadius = '6px';
                    item.innerHTML = `<strong>${escapeHtml(doc.id)}</strong>: ${escapeHtml(JSON.stringify(doc.data))}`;
                    list.appendChild(item);
                });

                container.innerHTML = '';
                container.appendChild(list);
            })
            .catch(err => {
                console.error('Error fetching Firebase publicData via module:', err);
                container.innerHTML = `<p style="color: #b00">Error loading data</p>`;
            });
        return;
    }

    // Fallback: if an older SDK was attached to window.db (legacy), try that too
    try {
        if (window.db && typeof window.db.collection === 'function') {
            window.db.collection('publicData').get()
                .then(querySnapshot => {
                    if (querySnapshot.empty) {
                        container.innerHTML = '<p>No public data available.</p>';
                        return;
                    }

                    const list = document.createElement('div');
                    list.style.display = 'grid';
                    list.style.gridGap = '8px';

                    querySnapshot.forEach(doc => {
                        const data = doc.data();
                        const item = document.createElement('div');
                        item.className = 'firebase-item';
                        item.style.padding = '8px';
                        item.style.border = '1px solid #eee';
                        item.style.borderRadius = '6px';
                        item.innerHTML = `<strong>${escapeHtml(doc.id)}</strong>: ${escapeHtml(JSON.stringify(data))}`;
                        list.appendChild(item);
                    });

                    container.innerHTML = '';
                    container.appendChild(list);
                })
                .catch(err => {
                    console.error('Error fetching Firebase publicData (legacy):', err);
                    container.innerHTML = `<p style="color: #b00">Error loading data</p>`;
                });
            return;
        }
    } catch (err) {
        console.warn('Fallback Firebase attempt failed', err);
    }

    container.innerHTML = `<p style="color: #b00">Firebase not configured</p>`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Expose for debugging
window.fetchFirebasePublicData = fetchFirebasePublicData;

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Role selection
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            if (role === currentRole) return;
            
            // Check if login is required
            if (role !== 'citizen' && !currentUser) {
                showLoginModal();
                return;
            }
            
            switchRole(role);
        });
    });
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logoutUser);
    
    // Login modal close
    document.querySelector('.close-modal').addEventListener('click', hideLoginModal);
    
    // Login role switching
    document.querySelectorAll('.login-role-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            switchLoginForm(role);
        });
    });
    
    // Login form submission
    document.querySelectorAll('.login-btn').forEach(btn => {
        btn.addEventListener('click', handleLogin);
    });
    
    // Get location button
    document.getElementById('getLocation')?.addEventListener('click', getCurrentLocation);
    
    // Click outside modal to close
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('loginModal');
        if (event.target === modal) {
            hideLoginModal();
        }
    });
}

// ===== LOGIN SYSTEM =====
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function switchLoginForm(role) {
    // Update active button
    document.querySelectorAll('.login-role-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.login-role-btn[data-role="${role}"]`).classList.add('active');
    
    // Show selected form
    document.querySelectorAll('.login-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`${role}Login`).classList.add('active');
}

function handleLogin() {
    const activeForm = document.querySelector('.login-form.active');
    const role = document.querySelector('.login-role-btn.active').getAttribute('data-role');
    
    let credentials = {};
    let isValid = true;
    
    switch(role) {
        case 'citizen':
            const email = document.getElementById('citizenEmail').value;
            const password = document.getElementById('citizenPassword').value;
            
            if (!email || !password) {
                showMessage('Please fill all fields', 'error');
                isValid = false;
                break;
            }
            
            credentials = { email, password, role };
            break;
            
        case 'worker':
            const workerId = document.getElementById('workerId').value;
            const pin = document.getElementById('workerPin').value;
            const location = document.getElementById('workerLocation').value;
            
            if (!workerId || !pin || pin.length !== 4) {
                showMessage('Please enter valid Employee ID and 4-digit PIN', 'error');
                isValid = false;
                break;
            }
            
            if (!location) {
                showMessage('Please verify your location', 'error');
                isValid = false;
                break;
            }
            
            credentials = { workerId, pin, location, role };
            break;
            
        case 'admin':
            const username = document.getElementById('adminUsername').value;
            const adminPassword = document.getElementById('adminPassword').value;
            const twoFA = document.getElementById('admin2fa').value;
            
            if (!username || !adminPassword || !twoFA || twoFA.length !== 6) {
                showMessage('Please fill all fields with valid 2FA code', 'error');
                isValid = false;
                break;
            }
            
            credentials = { username, password: adminPassword, twoFA, role };
            break;
    }
    
    if (isValid) {
        // Simulate login - In real app, this would be an API call
        simulateLogin(credentials);
    }
}

function simulateLogin(credentials) {
    // Mock user data based on role
    let userData = {};
    
    switch(credentials.role) {
        case 'citizen':
            userData = {
                id: 'CIT001',
                name: 'Rajesh Kumar',
                email: credentials.email,
                phone: '+919876543210',
                role: 'citizen',
                complaints: 5,
                rating: 4.2
            };
            break;
            
        case 'worker':
            userData = {
                id: 'WORK001',
                name: 'Amit Sharma',
                employeeId: credentials.workerId,
                role: 'worker',
                shiftStatus: 'off',
                tasksCompleted: 142,
                efficiency: 94,
                vehicle: 'GC-0452'
            };
            break;
            
        case 'admin':
            userData = {
                id: 'ADMIN001',
                name: 'Admin User',
                username: credentials.username,
                role: 'admin',
                permissions: ['all']
            };
            break;
    }
    
    // Set current user
    currentUser = userData;
    currentRole = credentials.role;
    
    // Update UI
    updateUserProfile();
    hideLoginModal();
    switchRole(currentRole);
    
    showMessage(`Welcome ${userData.name}! Login successful.`, 'success');
}

function logoutUser() {
    currentUser = null;
    currentRole = 'citizen';
    updateUserProfile();
    switchRole(currentRole);
    showMessage('Logged out successfully', 'success');
}

function checkLoginStatus() {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('garbageSystemUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentRole = currentUser.role;
        updateUserProfile();
        switchRole(currentRole);
    }
}

function updateUserProfile() {
    const userNameElement = document.querySelector('.user-name');
    const userRoleElement = document.querySelector('.user-role');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (currentUser) {
        userNameElement.textContent = currentUser.name;
        userRoleElement.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        
        // Save to localStorage
        localStorage.setItem('garbageSystemUser', JSON.stringify(currentUser));
    } else {
        userNameElement.textContent = 'Guest User';
        userRoleElement.textContent = 'Not Logged In';
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        
        // Remove from localStorage
        localStorage.removeItem('garbageSystemUser');
    }
}

// ===== ROLE MANAGEMENT =====
function switchRole(role) {
    currentRole = role;
    
    // Update role selector
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.role-btn[data-role="${role}"]`).classList.add('active');
    
    // Load role menu
    loadRole(role);
}

function loadRole(role) {
    const roleData = menuStructures[role];
    const menuTitle = document.getElementById('menuTitle');
    const menuList = document.getElementById('menuList');
    
    // Update menu title
    menuTitle.innerHTML = `<i class="${roleData.icon}"></i><span>${roleData.title}</span>`;
    
    // Clear and rebuild menu
    menuList.innerHTML = '';
    
    roleData.items.forEach((item, index) => {
        const isActive = index === 0 ? 'active' : '';
        const menuItem = document.createElement('li');
        menuItem.className = `menu-item ${isActive}`;
        menuItem.setAttribute('data-id', item.id);
        menuItem.innerHTML = `<i class="${item.icon}"></i><span>${item.name}</span>`;
        
        menuItem.addEventListener('click', function() {
            // Update active menu item
            document.querySelectorAll('.menu-item').forEach(item => {
                item.classList.remove('active');
            });
            this.classList.add('active');
            
            // Load content
            loadContent(item.id);
        });
        
        menuList.appendChild(menuItem);
    });
    
    // Load first item's content
    if (roleData.items.length > 0) {
        loadContent(roleData.items[0].id);
    }
}

// ===== CONTENT LOADING =====
function loadContent(contentId) {
    currentMenu = contentId;
    
    // Clear previous content
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div class="loading"></div>';
    
    // Simulate loading delay
    setTimeout(() => {
        let content = '';
        let title = '';
        
        switch(contentId) {
            // Citizen content
            case 'report':
                content = getReportGarbageContent();
                title = 'Report Garbage Issue';
                break;
            case 'track':
                content = getTrackStatusContent();
                title = 'Track Complaint Status';
                break;
            case 'notifications':
                content = getNotificationsContent();
                title = 'Notifications';
                break;
            case 'history':
                content = getHistoryContent();
                title = 'Complaint History';
                break;
            case 'smart_bins':
                content = getSmartBinsContent();
                title = 'Smart Dustbin Status';
                break;
                
            // Worker content
            case 'shift':
                content = getShiftManagementContent();
                title = 'Shift Management';
                break;
            case 'tasks':
                content = getAssignedTasksContent();
                title = 'Assigned Tasks';
                break;
            case 'update':
                content = getUpdateTaskContent();
                title = 'Update Task Status';
                break;
            case 'gps':
                content = getGPSTrackingContent();
                title = 'Live GPS Tracking';
                break;
            case 'route':
                content = getRouteOptimizationContent();
                title = 'AI-Optimized Routes';
                break;
                
            // Admin content
            case 'dashboard':
                content = getAdminDashboardContent();
                title = 'Admin Dashboard';
                break;
            case 'assign':
                content = getAssignCollectorContent();
                title = 'Assign Collector';
                break;
            case 'analytics':
                content = getAnalyticsContent();
                title = 'Analytics & Reports';
                break;
            case 'monitoring':
                content = getSmartBinMonitoringContent();
                title = 'Smart Dustbin Monitoring';
                break;
            case 'workers':
                content = getWorkerManagementContent();
                title = 'Worker Management';
                break;
            case 'hotspots':
                content = getHotspotDetectionContent();
                title = 'Garbage Hotspots';
                break;
                
            // AI content
            case 'image_verify':
                content = getImageVerificationContent();
                title = 'AI Image Verification';
                break;
            case 'severity':
                content = getSeverityDetectionContent();
                title = 'Severity Detection';
                break;
            case 'route_opt':
                content = getRouteOptimizationAIContent();
                title = 'Route Optimization';
                break;
            case 'hotspot_detect':
                content = getHotspotDetectionAIContent();
                title = 'Hotspot Detection';
                break;
            case 'predictive':
                content = getPredictiveAnalyticsContent();
                title = 'Predictive Analytics';
                break;
            case 'efficiency':
                content = getEfficiencyAnalysisContent();
                title = 'Efficiency Analysis';
                break;
                
            default:
                content = '<div class="card"><div class="card-content"><p>Content not found</p></div></div>';
                title = 'Error';
        }
        
        // Update page title
        document.getElementById('pageTitle').textContent = title;
        
        // Update content area
        contentArea.innerHTML = content;
        
        // Initialize any dynamic elements
        initializeContent(contentId);
        
    }, 500);
}

// ===== CONTENT TEMPLATES =====
function getReportGarbageContent() {
    return `
        <div class="card">
            <div class="card-title">
                <i class="fas fa-camera"></i>
                <span>Report Garbage Issue</span>
            </div>
            <div class="card-content">
                <form id="reportForm">
                    <div class="form-group">
                        <label for="issueType">Type of Issue</label>
                        <select id="issueType" required>
                            <option value="">Select issue type</option>
                            <option value="overflow">Dustbin Overflow</option>
                            <option value="illegal_dumping">Illegal Dumping</option>
                            <option value="damaged_bin">Damaged Dustbin</option>
                            <option value="not_collected">Garbage Not Collected</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="location">Location</label>
                        <input type="text" id="location" placeholder="Enter location" required>
                        <button type="button" class="btn-secondary btn-small mt-20" id="useCurrentLocation">
                            <i class="fas fa-map-marker-alt"></i> Use Current Location
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea id="description" rows="4" placeholder="Please describe the issue in detail"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="photo">Upload Photo</label>
                        <div class="photo-upload-area" id="photoUploadArea">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Drag & drop or click to upload photo</p>
                            <input type="file" id="photo" accept="image/*" capture="environment" style="display: none;">
                            <button type="button" class="btn-secondary btn-small" id="takePhotoBtn">
                                <i class="fas fa-camera"></i> Take Photo
                            </button>
                        </div>
                        <div id="photoPreview" class="mt-20" style="display: none;">
                            <img id="previewImage" src="" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                        </div>
                        <small class="mt-20">AI will analyze the image for verification and severity detection</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Report Anonymously</label>
                        <div class="checkbox-group">
                            <input type="checkbox" id="anonymous">
                            <label for="anonymous">Submit without personal information</label>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn">
                        <i class="fas fa-paper-plane"></i> Submit Report
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card ai-feature mt-20">
            <div class="card-title">
                <i class="fas fa-robot"></i>
                <span>AI Assistance</span>
            </div>
            <div class="card-content">
                <p>Our AI system will automatically:</p>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    <li>Verify the garbage issue from uploaded images</li>
                    <li>Detect severity level (Low, Medium, High)</li>
                    <li>Suggest priority based on location and type</li>
                    <li>Route optimization for collection teams</li>
                </ul>
            </div>
        </div>
    `;
}

function getTrackStatusContent() {
    return `
        <div class="card">
            <div class="card-title">
                <i class="fas fa-map-marked-alt"></i>
                <span>Track Your Complaints</span>
            </div>
            <div class="card-content">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Complaint ID</th>
                                <th>Date</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>#GC-1256</td>
                                <td>10 Jan, 2024</td>
                                <td>Main Street, Block A</td>
                                <td><span class="status-badge status-inprogress">In Progress</span></td>
                                <td><button class="btn btn-small" onclick="trackComplaint('GC-1256')">Track</button></td>
                            </tr>
                            <tr>
                                <td>#GC-1255</td>
                                <td>9 Jan, 2024</td>
                                <td>Central Park Area</td>
                                <td><span class="status-badge status-pending">Pending</span></td>
                                <td><button class="btn btn-small" onclick="trackComplaint('GC-1255')">Track</button></td>
                            </tr>
                            <tr>
                                <td>#GC-1254</td>
                                <td>8 Jan, 2024</td>
                                <td>Market Road</td>
                                <td><span class="status-badge status-completed">Completed</span></td>
                                <td><button class="btn btn-small" onclick="viewDetails('GC-1254')">Details</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="card mt-20" id="trackingDetails" style="display: none;">
            <div class="card-title">
                <i class="fas fa-satellite"></i>
                <span>Live Tracking - #GC-1256</span>
            </div>
            <div class="card-content">
                <div class="tracking-progress">
                    <div class="progress-steps">
                        <div class="step completed">
                            <div class="step-number">1</div>
                            <div class="step-label">Reported</div>
                            <div class="step-time">10:30 AM</div>
                        </div>
                        <div class="step completed">
                            <div class="step-number">2</div>
                            <div class="step-label">Verified</div>
                            <div class="step-time">10:45 AM</div>
                        </div>
                        <div class="step active">
                            <div class="step-number">3</div>
                            <div class="step-label">In Progress</div>
                            <div class="step-time">11:00 AM</div>
                        </div>
                        <div class="step">
                            <div class="step-number">4</div>
                            <div class="step-label">Completed</div>
                            <div class="step-time">--:--</div>
                        </div>
                    </div>
                </div>
                
                <div class="map-container mt-20">
                    <div id="map"></div>
                </div>
                
                <div class="stats-grid mt-20">
                    <div class="stat-box">
                        <div class="stat-number">15</div>
                        <div class="stat-label">Minutes to Arrival</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">2.5</div>
                        <div class="stat-label">KM Distance</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">Amit S.</div>
                        <div class="stat-label">Assigned Worker</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getShiftManagementContent() {
    return `
        <div class="card">
            <div class="card-title">
                <i class="fas fa-clock"></i>
                <span>Shift Management</span>
            </div>
            <div class="card-content">
                <div class="shift-status">
                    <div class="status-indicator ${currentUser?.shiftStatus === 'on' ? 'active' : 'inactive'}">
                        <i class="fas fa-${currentUser?.shiftStatus === 'on' ? 'play' : 'stop'}"></i>
                        <h3>Shift ${currentUser?.shiftStatus === 'on' ? 'Active' : 'Inactive'}</h3>
                    </div>
                    
                    ${currentUser?.shiftStatus === 'on' ? `
                        <div class="shift-details">
                            <p><strong>Started:</strong> 08:00 AM</p>
                            <p><strong>Duration:</strong> 4 hours 30 minutes</p>
                            <p><strong>Tasks Completed:</strong> 8/12</p>
                            <p><strong>Vehicle:</strong> ${currentUser?.vehicle || 'GC-0452'}</p>
                        </div>
                        
                        <div class="shift-actions mt-20">
                            <button class="btn btn-secondary" onclick="takeBreak()">
                                <i class="fas fa-coffee"></i> Take Break
                            </button>
                            <button class="btn btn-danger" onclick="endShift()">
                                <i class="fas fa-stop-circle"></i> End Shift
                            </button>
                        </div>
                    ` : `
                        <div class="shift-start-form mt-20">
                            <div class="form-group">
                                <label for="vehicleSelect">Select Vehicle</label>
                                <select id="vehicleSelect">
                                    <option value="GC-0452">GC-0452 (Truck)</option>
                                    <option value="GC-0453">GC-0453 (Mini Truck)</option>
                                    <option value="GC-0454">GC-0454 (Auto)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="equipmentCheck">Equipment Check</label>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="gloves" checked>
                                    <label for="gloves">Safety Gloves</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="mask" checked>
                                    <label for="mask">Face Mask</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="tools" checked>
                                    <label for="tools">Collection Tools</label>
                                </div>
                            </div>
                            <button class="btn" onclick="startShift()">
                                <i class="fas fa-play-circle"></i> Start Shift
                            </button>
                        </div>
                    `}
                </div>
            </div>
        </div>
        
        <div class="card mt-20">
            <div class="card-title">
                <i class="fas fa-chart-line"></i>
                <span>Today's Performance</span>
            </div>
            <div class="card-content">
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-number">${currentUser?.tasksCompleted || 0}</div>
                        <div class="stat-label">Tasks Completed</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${currentUser?.efficiency || 0}%</div>
                        <div class="stat-label">Efficiency</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">42</div>
                        <div class="stat-label">KM Traveled</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">4.8</div>
                        <div class="stat-label">Avg. Rating</div>
                    </div>
                </div>
                
                <div class="performance-chart mt-20">
                    <canvas id="performanceChart"></canvas>
                </div>
            </div>
        </div>
    `;
}

// Add more content functions as needed...

// ===== MAP FUNCTIONS =====
function initMap() {
    if (!map) {
        map = L.map('map').setView([28.6139, 77.2090], 12); // Default to Delhi
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }
    return map;
}

function addMarker(lat, lng, title, type = 'garbage') {
    const map = initMap();
    
    let iconColor = 'red';
    let icon = L.AwesomeMarkers.icon({
        icon: 'trash',
        markerColor: iconColor,
        prefix: 'fa'
    });
    
    const marker = L.marker([lat, lng], { icon: icon })
        .addTo(map)
        .bindPopup(`<b>${title}</b><br>Garbage reported here`);
    
    markers.push(marker);
    return marker;
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                document.getElementById('workerLocation').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            },
            (error) => {
                showMessage('Unable to get location: ' + error.message, 'error');
            }
        );
    } else {
        showMessage('Geolocation is not supported by your browser', 'error');
    }
}

// ===== UTILITY FUNCTIONS =====
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.innerHTML = `
        <span>${message}</span>
        <button class="close-message">&times;</button>
    `;
    
    // Add to page
    document.body.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
    
    // Close button
    messageDiv.querySelector('.close-message').addEventListener('click', () => {
        messageDiv.remove();
    });
}

function initializeContent(contentId) {
    switch(contentId) {
        case 'report':
            setupReportForm();
            break;
        case 'track':
            setupTracking();
            break;
        case 'shift':
            setupShiftManagement();
            break;
        // Add more cases as needed
    }
}

function setupReportForm() {
    // Photo upload handling
    const photoUploadArea = document.getElementById('photoUploadArea');
    const photoInput = document.getElementById('photo');
    const previewImage = document.getElementById('previewImage');
    const photoPreview = document.getElementById('photoPreview');
    
    if (photoUploadArea && photoInput) {
        photoUploadArea.addEventListener('click', () => {
            photoInput.click();
        });
        
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    photoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Take photo button
        const takePhotoBtn = document.getElementById('takePhotoBtn');
        if (takePhotoBtn) {
            takePhotoBtn.addEventListener('click', () => {
                photoInput.click();
            });
        }
    }
    
    // Use current location
    const useLocationBtn = document.getElementById('useCurrentLocation');
    if (useLocationBtn) {
        useLocationBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        document.getElementById('location').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    },
                    (error) => {
                        showMessage('Unable to get location: ' + error.message, 'error');
                    }
                );
            } else {
                showMessage('Geolocation is not supported by your browser', 'error');
            }
        });
    }
    
    // Form submission
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const issueType = document.getElementById('issueType').value;
            const location = document.getElementById('location').value;
            const description = document.getElementById('description').value;
            const isAnonymous = document.getElementById('anonymous').checked;
            
            if (!issueType || !location) {
                showMessage('Please fill all required fields', 'error');
                return;
            }
            
            // Generate complaint ID
            const complaintId = 'GC-' + Date.now().toString().slice(-6);
            
            // Show success message
            showMessage(`Complaint submitted successfully! Your complaint ID is ${complaintId}`, 'success');
            
            // Reset form
            reportForm.reset();
            if (photoPreview) photoPreview.style.display = 'none';
            
            // Simulate AI processing
            simulateAIProcessing(complaintId);
        });
    }
}

function simulateAIProcessing(complaintId) {
    setTimeout(() => {
        showMessage(`AI has verified complaint ${complaintId}. Severity: Medium. Assigned to worker.`, 'success');
    }, 2000);
}

function trackComplaint(complaintId) {
    // Show tracking details
    const trackingDetails = document.getElementById('trackingDetails');
    if (trackingDetails) {
        trackingDetails.style.display = 'block';
        
        // Initialize map
        initMap();
        
        // Add markers
        clearMarkers();
        addMarker(28.6139, 77.2090, 'Complaint Location');
        addMarker(28.6200, 77.2200, 'Worker Location', 'worker');
        
        // Fit bounds
        map.fitBounds([
            [28.6139, 77.2090],
            [28.6200, 77.2200]
        ]);
    }
}

function startShift() {
    const vehicle = document.getElementById('vehicleSelect')?.value;
    
    if (currentUser) {
        currentUser.shiftStatus = 'on';
        currentUser.vehicle = vehicle;
        updateUserProfile();
        loadContent('shift');
        showMessage('Shift started successfully!', 'success');
    }
}

function endShift() {
    if (currentUser) {
        currentUser.shiftStatus = 'off';
        updateUserProfile();
        loadContent('shift');
        showMessage('Shift ended successfully!', 'success');
    }
}

// ===== MOCK DATA GENERATORS =====
function generateMockComplaints(count = 10) {
    const complaints = [];
    const statuses = ['pending', 'inprogress', 'completed'];
    const types = ['overflow', 'illegal_dumping', 'damaged_bin', 'not_collected'];
    const locations = [
        'Main Street, Block A',
        'Central Park Area',
        'Market Road',
        'Station Road',
        'College Street',
        'Residential Area B'
    ];
    
    for (let i = 1; i <= count; i++) {
        const id = `GC-${1000 + i}`;
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 7));
        
        complaints.push({
            id,
            date: date.toLocaleDateString(),
            location: locations[Math.floor(Math.random() * locations.length)],
            type: types[Math.floor(Math.random() * types.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            severity: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
        });
    }
    
    return complaints;
}

function generateMockWorkers(count = 5) {
    const workers = [];
    const names = ['Amit Sharma', 'Rajesh Kumar', 'Sunil Patel', 'Vikram Singh', 'Anil Gupta'];
    const statuses = ['active', 'inactive', 'on_break'];
    
    for (let i = 0; i < count; i++) {
        workers.push({
            id: `WORK${100 + i}`,
            name: names[i],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            tasksCompleted: Math.floor(Math.random() * 100) + 50,
            efficiency: Math.floor(Math.random() * 30) + 70,
            rating: (Math.random() * 2 + 3).toFixed(1)
        });
    }
    
    return workers;
}

// ===== EXPORT FUNCTIONS =====
// Make functions available globally for HTML onclick events
window.trackComplaint = trackComplaint;
window.startShift = startShift;
window.endShift = endShift;
window.takeBreak = function() {
    showMessage('Break started for 15 minutes', 'warning');
};