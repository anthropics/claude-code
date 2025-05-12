// Main JavaScript for the Recursion Monitor Dashboard

// Configuration
const CONFIG = {
    refreshInterval: 30, // seconds
    chartColors: {
        primary: '#3f51b5',
        secondary: '#7986cb',
        accent: '#ff4081',
        success: '#4caf50',
        warning: '#ff9800',
        danger: '#f44336'
    },
    apiEndpoint: '/api/recursion-monitor',
    demoMode: true // Set to false in production
};

// Global state
let state = {
    activeFunctions: [],
    functionHistory: [],
    recentIssues: [],
    optimizationSuggestions: [],
    metrics: {
        totalFunctionsMonitored: 0,
        totalIssuesDetected: 0,
        totalIssuesFixed: 0,
        maxRecursionDepth: 0
    },
    settings: {
        maxRecursionDepthWarning: 1000,
        maxCallCountWarning: 10000,
        refreshInterval: CONFIG.refreshInterval,
        enableNotifications: true,
        notificationChannel: 'browser',
        webhookUrl: ''
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1
    },
    charts: {
        recursionTrends: null,
        callHistory: null
    },
    refreshTimer: null,
    searchTerm: ''
};

// DOM Elements
const elements = {
    // Metrics
    totalFunctionsMonitored: document.getElementById('totalFunctionsMonitored'),
    totalIssuesDetected: document.getElementById('totalIssuesDetected'),
    totalIssuesFixed: document.getElementById('totalIssuesFixed'),
    maxRecursionDepth: document.getElementById('maxRecursionDepth'),
    
    // Tables
    activeRecursionsTable: document.getElementById('activeRecursionsTable'),
    recursiveFunctionsTable: document.getElementById('recursiveFunctionsTable'),
    
    // Lists
    recentIssues: document.getElementById('recentIssues'),
    optimizationSuggestions: document.getElementById('optimizationSuggestions'),
    
    // Charts
    recursionTrendsChart: document.getElementById('recursionTrendsChart'),
    callHistoryChart: document.getElementById('callHistoryChart'),
    
    // Controls
    refreshButton: document.getElementById('refreshButton'),
    autoRefreshToggle: document.getElementById('autoRefreshToggle'),
    fullScanButton: document.getElementById('fullScanButton'),
    autoFixAllButton: document.getElementById('autoFixAllButton'),
    exportReportButton: document.getElementById('exportReportButton'),
    functionSearchInput: document.getElementById('functionSearchInput'),
    functionSearchButton: document.getElementById('functionSearchButton'),
    
    // Settings
    maxRecursionDepthSetting: document.getElementById('maxRecursionDepthSetting'),
    maxCallCountSetting: document.getElementById('maxCallCountSetting'),
    refreshIntervalSetting: document.getElementById('refreshIntervalSetting'),
    enableNotifications: document.getElementById('enableNotifications'),
    notificationChannelSetting: document.getElementById('notificationChannelSetting'),
    webhookUrlSetting: document.getElementById('webhookUrlSetting'),
    saveSettingsButton: document.getElementById('saveSettingsButton'),
    
    // Pagination
    functionsPagination: document.getElementById('functionsPagination'),
    
    // Modals
    functionDetailsModal: new bootstrap.Modal(document.getElementById('functionDetailsModal')),
    
    // Function Details
    detailsFunctionName: document.getElementById('detailsFunctionName'),
    detailsFilePath: document.getElementById('detailsFilePath'),
    detailsFirstSeen: document.getElementById('detailsFirstSeen'),
    detailsLastCalled: document.getElementById('detailsLastCalled'),
    detailsTotalCalls: document.getElementById('detailsTotalCalls'),
    detailsMaxDepth: document.getElementById('detailsMaxDepth'),
    detailsAvgExecTime: document.getElementById('detailsAvgExecTime'),
    detailsIssuesCount: document.getElementById('detailsIssuesCount'),
    detailsCodeSnippet: document.getElementById('detailsCodeSnippet'),
    detailsIssuesList: document.getElementById('detailsIssuesList'),
    detailsOptimizationList: document.getElementById('detailsOptimizationList'),
    optimizeFunctionButton: document.getElementById('optimizeFunctionButton'),
    debugFunctionButton: document.getElementById('debugFunctionButton')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    setupEventListeners();
});

// Initialize the dashboard
function initializeDashboard() {
    // Load settings
    loadSettings();
    
    // Initialize charts
    initializeCharts();
    
    // Load initial data
    fetchData();
    
    // Start auto-refresh timer
    startRefreshTimer();
}

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    elements.refreshButton.addEventListener('click', () => {
        fetchData();
        animateRefreshButton();
    });
    
    // Auto-refresh toggle
    elements.autoRefreshToggle.addEventListener('change', function() {
        if (this.checked) {
            startRefreshTimer();
        } else {
            stopRefreshTimer();
        }
    });
    
    // Full scan button
    elements.fullScanButton.addEventListener('click', () => {
        if (CONFIG.demoMode) {
            showNotification('Full project scan initiated', 'Running scan...');
            setTimeout(() => {
                showNotification('Scan complete', '3 new recursive functions detected');
                fetchData();
            }, 3000);
        } else {
            triggerFullScan();
        }
    });
    
    // Auto-fix all button
    elements.autoFixAllButton.addEventListener('click', () => {
        if (CONFIG.demoMode) {
            showNotification('Auto-fix initiated', 'Applying fixes to all issues...');
            setTimeout(() => {
                showNotification('Fixes applied', 'Successfully fixed 5 issues');
                fetchData();
            }, 3000);
        } else {
            triggerAutoFixAll();
        }
    });
    
    // Export report button
    elements.exportReportButton.addEventListener('click', () => {
        if (CONFIG.demoMode) {
            showNotification('Report generation started', 'Generating PDF report...');
            setTimeout(() => {
                showNotification('Report ready', 'The report has been saved');
            }, 2000);
        } else {
            generateReport();
        }
    });
    
    // Search input
    elements.functionSearchButton.addEventListener('click', () => {
        state.searchTerm = elements.functionSearchInput.value.toLowerCase();
        state.pagination.currentPage = 1;
        renderFunctionsTable();
    });
    
    elements.functionSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            state.searchTerm = elements.functionSearchInput.value.toLowerCase();
            state.pagination.currentPage = 1;
            renderFunctionsTable();
        }
    });
    
    // Settings form
    elements.saveSettingsButton.addEventListener('click', () => {
        saveSettings();
    });
    
    // Details modal buttons
    elements.optimizeFunctionButton.addEventListener('click', () => {
        const functionName = elements.detailsFunctionName.textContent;
        optimizeFunction(functionName);
    });
    
    elements.debugFunctionButton.addEventListener('click', () => {
        const functionName = elements.detailsFunctionName.textContent;
        debugFunction(functionName);
    });
}

// Initialize charts
function initializeCharts() {
    // Recursion trends chart
    const trendsCtx = elements.recursionTrendsChart.getContext('2d');
    state.charts.recursionTrends = new Chart(trendsCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Active Recursions',
                    data: [],
                    borderColor: CONFIG.chartColors.primary,
                    backgroundColor: hexToRgba(CONFIG.chartColors.primary, 0.1),
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Recursion Depth',
                    data: [],
                    borderColor: CONFIG.chartColors.accent,
                    backgroundColor: hexToRgba(CONFIG.chartColors.accent, 0.1),
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Issues Detected',
                    data: [],
                    borderColor: CONFIG.chartColors.danger,
                    backgroundColor: hexToRgba(CONFIG.chartColors.danger, 0.1),
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

// Fetch data from the server
function fetchData() {
    if (CONFIG.demoMode) {
        // Use demo data in demo mode
        generateDemoData();
        updateDashboard();
    } else {
        // Fetch real data from the API
        fetch(CONFIG.apiEndpoint)
            .then(response => response.json())
            .then(data => {
                // Update state with the fetched data
                state.activeFunctions = data.activeFunctions || [];
                state.functionHistory = data.functionHistory || [];
                state.recentIssues = data.recentIssues || [];
                state.optimizationSuggestions = data.optimizationSuggestions || [];
                state.metrics = data.metrics || state.metrics;
                
                // Update trend chart data
                if (data.trends) {
                    updateTrendChart(data.trends);
                }
                
                // Update the dashboard
                updateDashboard();
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                showNotification('Error', 'Failed to fetch monitoring data', 'error');
            });
    }
}

// Update the dashboard with current state
function updateDashboard() {
    // Update metrics
    elements.totalFunctionsMonitored.textContent = state.metrics.totalFunctionsMonitored;
    elements.totalIssuesDetected.textContent = state.metrics.totalIssuesDetected;
    elements.totalIssuesFixed.textContent = state.metrics.totalIssuesFixed;
    elements.maxRecursionDepth.textContent = state.metrics.maxRecursionDepth;
    
    // Update tables
    renderActiveFunctionsTable();
    renderFunctionsTable();
    
    // Update lists
    renderRecentIssues();
    renderOptimizationSuggestions();
}

// Render the active functions table
function renderActiveFunctionsTable() {
    elements.activeRecursionsTable.innerHTML = '';
    
    if (state.activeFunctions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center">No active recursive functions</td>';
        elements.activeRecursionsTable.appendChild(row);
        return;
    }
    
    state.activeFunctions.forEach(func => {
        const row = document.createElement('tr');
        
        // Determine status class
        let statusClass = 'bg-success';
        let statusText = 'Normal';
        
        if (func.currentDepth > state.settings.maxRecursionDepthWarning) {
            statusClass = 'bg-danger';
            statusText = 'Critical';
        } else if (func.currentDepth > state.settings.maxRecursionDepthWarning * 0.7) {
            statusClass = 'bg-warning';
            statusText = 'Warning';
        }
        
        row.innerHTML = `
            <td>${func.name}</td>
            <td>${func.file}</td>
            <td>${func.currentDepth}</td>
            <td>${func.callCount}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-sm btn-primary btn-action" onclick="showFunctionDetails('${func.name}')">
                    <i class="bi bi-info-circle"></i>
                </button>
                <button class="btn btn-sm btn-danger btn-action" onclick="terminateFunction('${func.name}')">
                    <i class="bi bi-x-circle"></i>
                </button>
            </td>
        `;
        
        elements.activeRecursionsTable.appendChild(row);
    });
}

// Render the function history table with pagination
function renderFunctionsTable() {
    elements.recursiveFunctionsTable.innerHTML = '';
    
    // Filter functions based on search term
    const filteredFunctions = state.functionHistory.filter(func => {
        if (!state.searchTerm) return true;
        return func.name.toLowerCase().includes(state.searchTerm) ||
               func.file.toLowerCase().includes(state.searchTerm);
    });
    
    // Calculate pagination
    state.pagination.totalPages = Math.ceil(filteredFunctions.length / state.pagination.itemsPerPage);
    
    if (filteredFunctions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" class="text-center">No recursive functions found</td>';
        elements.recursiveFunctionsTable.appendChild(row);
        
        // Clear pagination
        elements.functionsPagination.innerHTML = '';
        return;
    }
    
    // Get current page of functions
    const startIndex = (state.pagination.currentPage - 1) * state.pagination.itemsPerPage;
    const endIndex = startIndex + state.pagination.itemsPerPage;
    const currentPageFunctions = filteredFunctions.slice(startIndex, endIndex);
    
    // Render functions
    currentPageFunctions.forEach(func => {
        const row = document.createElement('tr');
        
        // Format date
        const lastInvocation = new Date(func.lastInvocation);
        const formattedDate = lastInvocation.toLocaleString();
        
        row.innerHTML = `
            <td>${func.name}</td>
            <td>${func.file}</td>
            <td>${func.maxDepth}</td>
            <td>${func.callCount}</td>
            <td>${formattedDate}</td>
            <td>${func.issues.length}</td>
            <td>
                <button class="btn btn-sm btn-primary btn-action" onclick="showFunctionDetails('${func.name}')">
                    <i class="bi bi-info-circle"></i>
                </button>
                <button class="btn btn-sm btn-success btn-action" onclick="optimizeFunction('${func.name}')">
                    <i class="bi bi-wrench"></i>
                </button>
                <button class="btn btn-sm btn-warning btn-action" onclick="debugFunction('${func.name}')">
                    <i class="bi bi-bug"></i>
                </button>
            </td>
        `;
        
        elements.recursiveFunctionsTable.appendChild(row);
    });
    
    // Render pagination
    renderPagination();
}

// Render pagination controls
function renderPagination() {
    elements.functionsPagination.innerHTML = '';
    
    if (state.pagination.totalPages <= 1) {
        return;
    }
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${state.pagination.currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" aria-label="Previous" ${state.pagination.currentPage > 1 ? 'onclick="changePage(' + (state.pagination.currentPage - 1) + ')"' : ''}>
            <span aria-hidden="true">&laquo;</span>
        </a>
    `;
    elements.functionsPagination.appendChild(prevLi);
    
    // Page numbers
    for (let i = 1; i <= state.pagination.totalPages; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === state.pagination.currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `
            <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
        `;
        elements.functionsPagination.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${state.pagination.currentPage === state.pagination.totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" aria-label="Next" ${state.pagination.currentPage < state.pagination.totalPages ? 'onclick="changePage(' + (state.pagination.currentPage + 1) + ')"' : ''}>
            <span aria-hidden="true">&raquo;</span>
        </a>
    `;
    elements.functionsPagination.appendChild(nextLi);
}

// Change pagination page
function changePage(page) {
    state.pagination.currentPage = page;
    renderFunctionsTable();
}

// Render recent issues
function renderRecentIssues() {
    elements.recentIssues.innerHTML = '';
    
    if (state.recentIssues.length === 0) {
        elements.recentIssues.innerHTML = '<p class="text-center text-muted">No recent issues detected</p>';
        return;
    }
    
    state.recentIssues.forEach(issue => {
        const issueElement = document.createElement('div');
        issueElement.className = `issue-card ${issue.severity === 'warning' ? 'warning' : ''}`;
        
        // Format date
        const timestamp = new Date(issue.timestamp);
        const formattedDate = timestamp.toLocaleString();
        
        issueElement.innerHTML = `
            <h6>${issue.function} - ${issue.type}</h6>
            <p>${issue.description}</p>
            <div class="d-flex justify-content-between align-items-center">
                <small class="timestamp">${formattedDate}</small>
                <button class="btn btn-sm btn-outline-primary" onclick="showFunctionDetails('${issue.function}')">
                    View Details
                </button>
            </div>
        `;
        
        elements.recentIssues.appendChild(issueElement);
    });
}

// Render optimization suggestions
function renderOptimizationSuggestions() {
    elements.optimizationSuggestions.innerHTML = '';
    
    if (state.optimizationSuggestions.length === 0) {
        elements.optimizationSuggestions.innerHTML = '<p class="text-center text-muted">No optimization suggestions available</p>';
        return;
    }
    
    state.optimizationSuggestions.forEach(suggestion => {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion-card';
        
        suggestionElement.innerHTML = `
            <h6>${suggestion.function}</h6>
            <p class="optimization-type">${suggestion.type}</p>
            <p>${suggestion.description}</p>
            <div class="d-flex justify-content-between align-items-center">
                <small>Estimated improvement: ${suggestion.improvement}</small>
                <button class="btn btn-sm btn-outline-success" onclick="applySuggestion('${suggestion.function}', '${suggestion.type}')">
                    Apply
                </button>
            </div>
        `;
        
        elements.optimizationSuggestions.appendChild(suggestionElement);
    });
}

// Show function details in modal
function showFunctionDetails(functionName) {
    // Find function in history
    const func = state.functionHistory.find(f => f.name === functionName);
    
    if (!func) {
        showNotification('Error', 'Function details not found', 'error');
        return;
    }
    
    // Update modal title
    document.getElementById('functionDetailsTitle').textContent = `Function Details: ${func.name}`;
    
    // Update general information
    elements.detailsFunctionName.textContent = func.name;
    elements.detailsFilePath.textContent = func.file;
    elements.detailsFirstSeen.textContent = new Date(func.firstSeen).toLocaleString();
    elements.detailsLastCalled.textContent = new Date(func.lastInvocation).toLocaleString();
    
    // Update metrics
    elements.detailsTotalCalls.textContent = func.callCount;
    elements.detailsMaxDepth.textContent = func.maxDepth;
    elements.detailsAvgExecTime.textContent = `${func.avgExecTime.toFixed(2)} ms`;
    elements.detailsIssuesCount.textContent = func.issues.length;
    
    // Update code snippet
    elements.detailsCodeSnippet.textContent = func.codeSnippet || 'Code snippet not available';
    if (window.Prism) {
        Prism.highlightElement(elements.detailsCodeSnippet);
    }
    
    // Update issues list
    elements.detailsIssuesList.innerHTML = '';
    if (func.issues.length === 0) {
        elements.detailsIssuesList.innerHTML = '<div class="list-group-item">No issues detected</div>';
    } else {
        func.issues.forEach(issue => {
            const issueElement = document.createElement('div');
            issueElement.className = 'list-group-item issue';
            
            issueElement.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${issue.type}</h6>
                    <small>${issue.severity}</small>
                </div>
                <p class="mb-1">${issue.description}</p>
                ${issue.location ? `<small>Location: ${issue.location}</small>` : ''}
            `;
            
            elements.detailsIssuesList.appendChild(issueElement);
        });
    }
    
    // Update optimization list
    elements.detailsOptimizationList.innerHTML = '';
    if (!func.optimizations || func.optimizations.length === 0) {
        elements.detailsOptimizationList.innerHTML = '<div class="list-group-item">No optimization suggestions</div>';
    } else {
        func.optimizations.forEach(opt => {
            const optElement = document.createElement('div');
            optElement.className = 'list-group-item optimization';
            
            optElement.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${opt.type}</h6>
                    <small>Estimated improvement: ${opt.improvement}</small>
                </div>
                <p class="mb-1">${opt.description}</p>
            `;
            
            elements.detailsOptimizationList.appendChild(optElement);
        });
    }
    
    // Initialize call history chart if not already initialized
    if (func.callHistory && func.callHistory.length > 0) {
        initializeCallHistoryChart(func.callHistory);
    }
    
    // Show modal
    elements.functionDetailsModal.show();
}

// Initialize call history chart
function initializeCallHistoryChart(callHistory) {
    // Destroy existing chart if it exists
    if (state.charts.callHistory) {
        state.charts.callHistory.destroy();
    }
    
    // Prepare data
    const labels = callHistory.map(entry => new Date(entry.timestamp).toLocaleTimeString());
    const depthData = callHistory.map(entry => entry.depth);
    const durationData = callHistory.map(entry => entry.duration);
    
    // Create new chart
    const ctx = elements.callHistoryChart.getContext('2d');
    state.charts.callHistory = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Recursion Depth',
                    data: depthData,
                    borderColor: CONFIG.chartColors.primary,
                    backgroundColor: hexToRgba(CONFIG.chartColors.primary, 0.1),
                    yAxisID: 'y',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Execution Time (ms)',
                    data: durationData,
                    borderColor: CONFIG.chartColors.secondary,
                    backgroundColor: hexToRgba(CONFIG.chartColors.secondary, 0.1),
                    yAxisID: 'y1',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Recursion Depth'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Execution Time (ms)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Update trend chart with new data
function updateTrendChart(trends) {
    if (!state.charts.recursionTrends) return;
    
    // Update chart data
    state.charts.recursionTrends.data.labels = trends.timestamps.map(t => new Date(t).toLocaleTimeString());
    state.charts.recursionTrends.data.datasets[0].data = trends.activeRecursions;
    state.charts.recursionTrends.data.datasets[1].data = trends.recursionDepths;
    state.charts.recursionTrends.data.datasets[2].data = trends.issuesDetected;
    
    // Update chart
    state.charts.recursionTrends.update();
}

// Load settings from local storage
function loadSettings() {
    const savedSettings = localStorage.getItem('recursionMonitorSettings');
    
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            state.settings = { ...state.settings, ...parsedSettings };
            
            // Update settings form
            elements.maxRecursionDepthSetting.value = state.settings.maxRecursionDepthWarning;
            elements.maxCallCountSetting.value = state.settings.maxCallCountWarning;
            elements.refreshIntervalSetting.value = state.settings.refreshInterval;
            elements.enableNotifications.checked = state.settings.enableNotifications;
            elements.notificationChannelSetting.value = state.settings.notificationChannel;
            elements.webhookUrlSetting.value = state.settings.webhookUrl || '';
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Save settings to local storage
function saveSettings() {
    // Update settings from form
    state.settings.maxRecursionDepthWarning = parseInt(elements.maxRecursionDepthSetting.value);
    state.settings.maxCallCountWarning = parseInt(elements.maxCallCountSetting.value);
    state.settings.refreshInterval = parseInt(elements.refreshIntervalSetting.value);
    state.settings.enableNotifications = elements.enableNotifications.checked;
    state.settings.notificationChannel = elements.notificationChannelSetting.value;
    state.settings.webhookUrl = elements.webhookUrlSetting.value;
    
    // Save to local storage
    localStorage.setItem('recursionMonitorSettings', JSON.stringify(state.settings));
    
    // Update refresh timer
    stopRefreshTimer();
    startRefreshTimer();
    
    // Show notification
    showNotification('Settings Saved', 'Your settings have been updated');
    
    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
}

// Start auto-refresh timer
function startRefreshTimer() {
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
    }
    
    state.refreshTimer = setInterval(() => {
        fetchData();
    }, state.settings.refreshInterval * 1000);
}

// Stop auto-refresh timer
function stopRefreshTimer() {
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
        state.refreshTimer = null;
    }
}

// Animate refresh button
function animateRefreshButton() {
    elements.refreshButton.classList.add('animate-pulse');
    setTimeout(() => {
        elements.refreshButton.classList.remove('animate-pulse');
    }, 1000);
}

// Show notification
function showNotification(title, message, type = 'info') {
    if (!state.settings.enableNotifications) return;
    
    // Browser notifications
    if (state.settings.notificationChannel === 'browser') {
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, { body: message });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(title, { body: message });
                    }
                });
            }
        }
    }
    
    // Slack webhook
    if (state.settings.notificationChannel === 'slack' && state.settings.webhookUrl) {
        fetch(state.settings.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: `*${title}*\n${message}`
            })
        }).catch(error => {
            console.error('Error sending Slack notification:', error);
        });
    }
    
    // Email notifications would require server-side integration
    if (state.settings.notificationChannel === 'email') {
        // In a real implementation, this would call an API endpoint
        if (!CONFIG.demoMode) {
            fetch('/api/recursion-monitor/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'email',
                    title,
                    message
                })
            }).catch(error => {
                console.error('Error sending email notification:', error);
            });
        }
    }
    
    // In-app notification (toast)
    // This would be implemented with a toast library in a real application
    console.log(`Notification (${type}): ${title} - ${message}`);
}

// Function actions

// Optimize a function
function optimizeFunction(functionName) {
    if (CONFIG.demoMode) {
        showNotification('Optimization Started', `Optimizing ${functionName}...`);
        setTimeout(() => {
            showNotification('Optimization Complete', `Successfully optimized ${functionName}`);
            fetchData();
            
            // Close modal if open
            if (document.getElementById('functionDetailsModal').classList.contains('show')) {
                elements.functionDetailsModal.hide();
            }
        }, 2000);
    } else {
        fetch(`${CONFIG.apiEndpoint}/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                functionName
            })
        })
        .then(response => response.json())
        .then(data => {
            showNotification('Optimization Complete', data.message);
            fetchData();
            
            // Close modal if open
            if (document.getElementById('functionDetailsModal').classList.contains('show')) {
                elements.functionDetailsModal.hide();
            }
        })
        .catch(error => {
            console.error('Error optimizing function:', error);
            showNotification('Error', 'Failed to optimize function', 'error');
        });
    }
}

// Debug a function
function debugFunction(functionName) {
    if (CONFIG.demoMode) {
        showNotification('Debugging Started', `Debugging ${functionName}...`);
        setTimeout(() => {
            showNotification('Debugging Complete', `Analysis of ${functionName} is ready`);
            
            // In demo mode, just show the function details again to simulate analysis
            const func = state.functionHistory.find(f => f.name === functionName);
            if (func) {
                showFunctionDetails(functionName);
            }
        }, 2000);
    } else {
        fetch(`${CONFIG.apiEndpoint}/debug`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                functionName
            })
        })
        .then(response => response.json())
        .then(data => {
            showNotification('Debugging Complete', data.message);
            fetchData();
            
            // Refresh function details if modal is open
            if (document.getElementById('functionDetailsModal').classList.contains('show')) {
                showFunctionDetails(functionName);
            }
        })
        .catch(error => {
            console.error('Error debugging function:', error);
            showNotification('Error', 'Failed to debug function', 'error');
        });
    }
}

// Terminate a function (for active recursions)
function terminateFunction(functionName) {
    if (CONFIG.demoMode) {
        showNotification('Function Terminated', `Terminated ${functionName}`);
        
        // Remove from active functions in demo mode
        state.activeFunctions = state.activeFunctions.filter(f => f.name !== functionName);
        renderActiveFunctionsTable();
    } else {
        fetch(`${CONFIG.apiEndpoint}/terminate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                functionName
            })
        })
        .then(response => response.json())
        .then(data => {
            showNotification('Function Terminated', data.message);
            fetchData();
        })
        .catch(error => {
            console.error('Error terminating function:', error);
            showNotification('Error', 'Failed to terminate function', 'error');
        });
    }
}

// Apply a specific optimization suggestion
function applySuggestion(functionName, suggestionType) {
    if (CONFIG.demoMode) {
        showNotification('Applying Suggestion', `Applying ${suggestionType} to ${functionName}...`);
        setTimeout(() => {
            showNotification('Suggestion Applied', `Successfully applied ${suggestionType} to ${functionName}`);
            fetchData();
        }, 2000);
    } else {
        fetch(`${CONFIG.apiEndpoint}/apply-suggestion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                functionName,
                suggestionType
            })
        })
        .then(response => response.json())
        .then(data => {
            showNotification('Suggestion Applied', data.message);
            fetchData();
        })
        .catch(error => {
            console.error('Error applying suggestion:', error);
            showNotification('Error', 'Failed to apply suggestion', 'error');
        });
    }
}

// Trigger a full project scan
function triggerFullScan() {
    fetch(`${CONFIG.apiEndpoint}/full-scan`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        showNotification('Scan Complete', data.message);
        fetchData();
    })
    .catch(error => {
        console.error('Error during full scan:', error);
        showNotification('Error', 'Failed to complete scan', 'error');
    });
}

// Trigger auto-fix for all issues
function triggerAutoFixAll() {
    fetch(`${CONFIG.apiEndpoint}/auto-fix-all`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        showNotification('Auto-Fix Complete', data.message);
        fetchData();
    })
    .catch(error => {
        console.error('Error during auto-fix:', error);
        showNotification('Error', 'Failed to auto-fix issues', 'error');
    });
}

// Generate a report
function generateReport() {
    fetch(`${CONFIG.apiEndpoint}/report`, {
        method: 'POST'
    })
    .then(response => response.blob())
    .then(blob => {
        // Create a link to download the report
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recursion-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Report Generated', 'The report has been downloaded');
    })
    .catch(error => {
        console.error('Error generating report:', error);
        showNotification('Error', 'Failed to generate report', 'error');
    });
}

// Helper function to convert hex color to rgba with opacity
function hexToRgba(hex, opacity) {
    // Remove the hash if it exists
    hex = hex.replace('#', '');
    
    // Parse the hex color
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Demo data generation for development/preview mode
function generateDemoData() {
    // Generate random metrics
    state.metrics = {
        totalFunctionsMonitored: Math.floor(Math.random() * 30) + 10,
        totalIssuesDetected: Math.floor(Math.random() * 20) + 5,
        totalIssuesFixed: Math.floor(Math.random() * 10) + 2,
        maxRecursionDepth: Math.floor(Math.random() * 2000) + 500
    };
    
    // Generate active functions
    state.activeFunctions = [];
    const numActiveFunctions = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < numActiveFunctions; i++) {
        const depth = Math.floor(Math.random() * 1500) + 100;
        
        state.activeFunctions.push({
            name: `fibonacci_${i}`,
            file: `src/algorithms/fibonacci_${i}.js`,
            currentDepth: depth,
            callCount: Math.floor(Math.random() * 10000) + 1000,
            maxDepth: depth + Math.floor(Math.random() * 500),
            lastInvocation: new Date().toISOString()
        });
    }
    
    // Generate function history
    state.functionHistory = [];
    const functionNames = [
        'fibonacci', 'factorial', 'treeTraversal', 'graphSearch',
        'quickSort', 'mergeSort', 'binarySearch', 'depthFirstSearch',
        'breadthFirstSearch', 'hanoi', 'permutations', 'combinations'
    ];
    
    const issueTypes = [
        'missing_base_case', 'stack_overflow_risk', 'infinite_recursion',
        'redundant_computation', 'unnecessary_copying', 'memory_leak'
    ];
    
    const optimizationTypes = [
        'memoization', 'tail_call_optimization', 'iterative_transformation',
        'parallel_execution', 'batch_processing', 'early_termination'
    ];
    
    for (let i = 0; i < 20; i++) {
        const funcName = functionNames[i % functionNames.length];
        const variant = Math.floor(i / functionNames.length) + 1;
        const fullName = variant > 1 ? `${funcName}_v${variant}` : funcName;
        
        // Generate random issues
        const issues = [];
        const numIssues = Math.floor(Math.random() * 3);
        
        for (let j = 0; j < numIssues; j++) {
            const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
            issues.push({
                type: issueType,
                description: `This function has a ${issueType.replace(/_/g, ' ')} issue that could cause problems.`,
                severity: Math.random() > 0.7 ? 'critical' : 'warning',
                location: `Line ${Math.floor(Math.random() * 50) + 10}`
            });
        }
        
        // Generate random optimizations
        const optimizations = [];
        const numOptimizations = Math.floor(Math.random() * 2);
        
        for (let j = 0; j < numOptimizations; j++) {
            const optType = optimizationTypes[Math.floor(Math.random() * optimizationTypes.length)];
            optimizations.push({
                type: optType,
                description: `Applying ${optType.replace(/_/g, ' ')} could improve performance.`,
                improvement: `${Math.floor(Math.random() * 90) + 10}%`
            });
        }
        
        // Generate call history
        const callHistory = [];
        const numCalls = Math.floor(Math.random() * 10) + 5;
        let baseTime = Date.now() - (numCalls * 60000); // Starting from 'numCalls' minutes ago
        
        for (let j = 0; j < numCalls; j++) {
            baseTime += Math.floor(Math.random() * 10000) + 5000; // 5-15 seconds between calls
            callHistory.push({
                timestamp: new Date(baseTime).toISOString(),
                depth: Math.floor(Math.random() * 1000) + 100,
                duration: Math.floor(Math.random() * 500) + 50
            });
        }
        
        // Add function to history
        state.functionHistory.push({
            name: fullName,
            file: `src/algorithms/${fullName.toLowerCase()}.js`,
            maxDepth: Math.floor(Math.random() * 2000) + 100,
            callCount: Math.floor(Math.random() * 10000) + 100,
            firstSeen: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(), // 0-30 days ago
            lastInvocation: new Date(Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString(), // 0-24 hours ago
            avgExecTime: Math.floor(Math.random() * 200) + 10,
            issues,
            optimizations,
            callHistory,
            codeSnippet: `function ${fullName}(n) {
    // Base case
    if (n <= 1) {
        return n;
    }
    
    // Recursive case
    return ${fullName}(n - 1) + ${fullName}(n - 2);
}`
        });
    }
    
    // Generate recent issues
    state.recentIssues = [];
    const numRecentIssues = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < numRecentIssues; i++) {
        const func = state.functionHistory[Math.floor(Math.random() * state.functionHistory.length)];
        const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
        
        state.recentIssues.push({
            function: func.name,
            type: issueType,
            description: `This function has a ${issueType.replace(/_/g, ' ')} issue that could cause problems.`,
            severity: Math.random() > 0.7 ? 'critical' : 'warning',
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 60 * 60 * 1000)).toISOString() // 0-60 minutes ago
        });
    }
    
    // Sort by most recent
    state.recentIssues.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Generate optimization suggestions
    state.optimizationSuggestions = [];
    const numSuggestions = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numSuggestions; i++) {
        const func = state.functionHistory[Math.floor(Math.random() * state.functionHistory.length)];
        const optType = optimizationTypes[Math.floor(Math.random() * optimizationTypes.length)];
        
        state.optimizationSuggestions.push({
            function: func.name,
            type: optType,
            description: `Applying ${optType.replace(/_/g, ' ')} could improve performance.`,
            improvement: `${Math.floor(Math.random() * 90) + 10}%`
        });
    }
    
    // Generate trend data for chart
    const timestamps = [];
    const activeRecursions = [];
    const recursionDepths = [];
    const issuesDetected = [];
    
    const numPoints = 20;
    const now = Date.now();
    
    for (let i = 0; i < numPoints; i++) {
        timestamps.push(new Date(now - ((numPoints - i) * 5 * 60 * 1000)).toISOString()); // Every 5 minutes
        activeRecursions.push(Math.floor(Math.random() * 8) + 1);
        recursionDepths.push(Math.floor(Math.random() * 1500) + 100);
        issuesDetected.push(Math.floor(Math.random() * 5));
    }
    
    // Update trend chart
    updateTrendChart({
        timestamps,
        activeRecursions,
        recursionDepths,
        issuesDetected
    });
}

// Make functions available globally
window.showFunctionDetails = showFunctionDetails;
window.optimizeFunction = optimizeFunction;
window.debugFunction = debugFunction;
window.terminateFunction = terminateFunction;
window.applySuggestion = applySuggestion;
window.changePage = changePage;
