const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT =  3000;

// JWT Secret - In production, this should be in environment variables
const JWT_SECRET = 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '1h';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// IMPORTANT: Define the module mapping endpoint FIRST to ensure it takes priority
app.get('/api/modules/mapping', (req, res) => {
  console.log('Module mapping endpoint called');
  
  // Ensure we have some data to return
  if (Object.keys(moduleToSubModules).length === 0 && matrixData.length > 0) {
    console.log('No module mapping found, generating from matrix data...');
    
    // Create mapping from matrix data on-the-fly if needed
    const mapping = {};
    matrixData.forEach(item => {
      if (item.module) {
        if (!mapping[item.module]) {
          mapping[item.module] = [];
        }
        
        if (item.subModule && !mapping[item.module].includes(item.subModule)) {
          mapping[item.module].push(item.subModule);
        }
      }
    });
    
    // Sort the submodules for each module
    Object.keys(mapping).forEach(module => {
      mapping[module].sort();
    });
    
    console.log(`Generated ${Object.keys(mapping).length} modules in mapping`);
    res.json(mapping);
  } else {
    console.log(`Returning ${Object.keys(moduleToSubModules).length} modules in mapping`);
    res.json(moduleToSubModules);
  }
});

// Debug endpoint to help diagnose mapping issues
app.get('/api/debug/mapping', (req, res) => {
  res.json({
    moduleToSubModules: moduleToSubModules,
    hasData: Object.keys(moduleToSubModules).length > 0,
    matrixDataCount: matrixData.length,
    matrixDataHasSubModules: matrixData.some(item => item.subModule)
  });
});

// Load data from JSON file
const dataFilePath = path.join(__dirname, 'iepDepMtrData.json');
let jsonData;

try {
  const rawData = fs.readFileSync(dataFilePath);
  jsonData = JSON.parse(rawData);
  console.log('Data loaded successfully from iepDepMtrData.json');
  
  // Log the module mapping for debugging
  if (jsonData.moduleToSubModules) {
    console.log(`Loaded module mapping with ${Object.keys(jsonData.moduleToSubModules).length} modules`);
  } else {
    console.log('No module mapping found in data file, will auto-generate from matrix data');
  }
} catch (error) {
  console.error('Error loading data from file:', error);
  jsonData = {
    users: [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'user', password: 'user123', role: 'user' }
    ],
    modules: [],
    moduleToSubModules: {},
    matrixData: []
  };
}

// Get data from JSON
const users = jsonData.users || [];
let matrixData = jsonData.matrixData || [];

// Auto-generate moduleToSubModules from matrix data if it doesn't exist or is empty
let moduleToSubModules = jsonData.moduleToSubModules || {};
if (Object.keys(moduleToSubModules).length === 0 && matrixData.length > 0) {
  console.log('Auto-generating moduleToSubModules mapping from matrix data...');
  
  // Create a mapping of modules to their submodules
  moduleToSubModules = {};
  matrixData.forEach(item => {
    if (item.module && item.subModule) {
      if (!moduleToSubModules[item.module]) {
        moduleToSubModules[item.module] = [];
      }
      
      // Only add the submodule if it doesn't already exist in the array
      if (!moduleToSubModules[item.module].includes(item.subModule)) {
        moduleToSubModules[item.module].push(item.subModule);
      }
    }
  });
  
  // Sort the submodules for each module
  Object.keys(moduleToSubModules).forEach(module => {
    moduleToSubModules[module].sort();
  });
  
  // Save the generated mapping back to the JSON data
  jsonData.moduleToSubModules = moduleToSubModules;
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(jsonData, null, 2));
    console.log('Generated moduleToSubModules mapping saved to data file');
  } catch (error) {
    console.error('Error saving generated mapping to file:', error);
  }
  
  console.log(`Auto-generated module mapping with ${Object.keys(moduleToSubModules).length} modules`);
}

// --- FIXED ROUTE ORDER: Put specific endpoints before wildcard routes ---

// IMPORTANT: Module mapping endpoint MUST be defined before other routes
app.get('/api/modules/mapping', (req, res) => {
  console.log('Module mapping endpoint called');
  
  // Ensure we have some data to return
  if (Object.keys(moduleToSubModules).length === 0 && matrixData.length > 0) {
    console.log('No module mapping found, generating from matrix data...');
    
    // Create mapping from matrix data on-the-fly if needed
    const mapping = {};
    matrixData.forEach(item => {
      if (item.module) {
        if (!mapping[item.module]) {
          mapping[item.module] = [];
        }
        
        if (item.subModule && !mapping[item.module].includes(item.subModule)) {
          mapping[item.module].push(item.subModule);
        }
      }
    });
    
    // Sort the submodules for each module
    Object.keys(mapping).forEach(module => {
      mapping[module].sort();
    });
    
    console.log(`Generated ${Object.keys(mapping).length} modules in mapping`);
    res.json(mapping);
  } else {
    console.log(`Returning ${Object.keys(moduleToSubModules).length} modules in mapping`);
    res.json(moduleToSubModules);
  }
});

// 1. Specific endpoints with fixed paths
// Debug routes for troubleshooting
app.get('/api/debug/mapping', (req, res) => {
  console.log('Debug mapping endpoint called, returning:', JSON.stringify(moduleToSubModules));
  res.json({
    moduleToSubModules: moduleToSubModules,
    hasData: Object.keys(moduleToSubModules).length > 0,
    matrixDataCount: matrixData.length,
    matrixDataHasSubModules: matrixData.some(item => item.subModule)
  });
});

// Get matrix data endpoint - protected
app.get('/api/matrix', authenticateToken, (req, res) => {
  // Use the helper function to normalize the data before sending to the client
  const normalizedData = normalizeMatrixItems(matrixData, moduleToSubModules);
  res.json(normalizedData);
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Find user with matching credentials
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // Generate an access token
    const accessToken = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    // Return user info and token
    res.json({
      success: true,
      username: user.username,
      role: user.role,
      accessToken: accessToken
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }
});

// Check if API exists endpoint - protected
app.get('/api/matrix/check-api', authenticateToken, (req, res) => {
  const { api, excludeId } = req.query;
  const id = excludeId ? parseInt(excludeId) : undefined;
  
  const exists = matrixData.some(item => {
    if (id !== undefined && item.id === id) {
      return false; // Skip the item being edited
    }
    return item.api === api;
  });
  
  res.json(exists);
});

// Get matrix statistics - protected
app.get('/api/matrix/stats', authenticateToken, (req, res) => {
  const stats = {
    totalItems: matrixData.length,
    moduleBreakdown: {},
    subModuleBreakdown: {},
    dependencyCount: {}
  };
  
  // Count modules and dependencies
  matrixData.forEach(item => {
    // Count by module
    if (stats.moduleBreakdown[item.module]) {
      stats.moduleBreakdown[item.module]++;
    } else {
      stats.moduleBreakdown[item.module] = 1;
    }
    
    // Count by subModule
    if (stats.subModuleBreakdown[item.subModule]) {
      stats.subModuleBreakdown[item.subModule]++;
    } else {
      stats.subModuleBreakdown[item.subModule] = 1;
    }
    
    // Count by dependant functionality
    if (stats.dependencyCount[item.dependantFunctionality]) {
      stats.dependencyCount[item.dependantFunctionality]++;
    } else {
      stats.dependencyCount[item.dependantFunctionality] = 1;
    }
  });
  
  res.json(stats);
});

// Export to Excel endpoint - protected
app.get('/api/matrix/export', authenticateToken, async (req, res) => {
  try {
    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('IEP Dependency Matrix');
    
    // Define columns with fixed widths - added subModule column
    worksheet.columns = [
      { header: 'Module', key: 'module', width: 20 },
      { header: 'Sub Module', key: 'subModule', width: 20 },
      { header: 'Functionality', key: 'functionality', width: 25 },
      { header: 'Dependency Module', key: 'dependencyModule', width: 25 },
      { header: 'Dependant Functionality', key: 'dependantFunctionality', width: 25 },
      { header: 'API', key: 'api', width: 30 }
    ];
    
    // Add a title row with styling
    worksheet.insertRow(1, []);
    worksheet.mergeCells('A1:F1'); // Updated to include new column
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'IEP Dependency Matrix';
    titleCell.font = {
      size: 16,
      bold: true,
      color: { argb: 'FFFFFF' },
      wrapText: true,
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0D5141' }
    };
    titleCell.alignment = { 
      horizontal: 'center',
      vertical: 'middle'
    };
    
    // Add padding by adjusting row height
    worksheet.getRow(1).height = 60;
    
    // Style the header row (now row 2)
    const headerRow = worksheet.getRow(2);
    headerRow.height = 40;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
        wordwrap: true
      };
    });
    
    // Add data rows with null/undefined checks
    matrixData.forEach(item => {
      worksheet.addRow({
        module: item.module || '',
        subModule: item.subModule || '',
        functionality: item.functionality || '',
        dependencyModule: item.dependencyModule || '',
        dependantFunctionality: item.dependantFunctionality || '',
        api: item.api || ''
      });
    });
    
    // Style all data cells
    for (let i = 3; i <= matrixData.length + 2; i++) {
      const row = worksheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // Set response headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=iep-dependency-matrix.xlsx');
    
    // Write to buffer first to avoid stream issues
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).json({ 
      message: 'Error generating Excel file', 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Export filtered data to Excel endpoint - protected
app.post('/api/matrix/export-filtered', authenticateToken, async (req, res) => {
  try {
    const filteredData = req.body;
    
    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('IEP Dependency Matrix');
    
    // Define columns with fixed widths - added subModule column
    worksheet.columns = [
      { header: 'Module', key: 'module', width: 20 },
      { header: 'Sub Module', key: 'subModule', width: 20 },
      { header: 'Functionality', key: 'functionality', width: 25 },
      { header: 'Dependency Module', key: 'dependencyModule', width: 25 },
      { header: 'Dependant Functionality', key: 'dependantFunctionality', width: 25 },
      { header: 'API', key: 'api', width: 30 }
    ];
    
    // Add a title row with styling
    worksheet.insertRow(1, []);
    worksheet.mergeCells('A1:F1'); // Updated to include new column
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'IEP Dependency Matrix';
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0D5141' }
    };
    titleCell.font = {
      size: 16,
      bold: true,
      color: { argb: 'FFFFFF' },
      wrapText: true
    };
    titleCell.alignment = { 
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
      wordwrap: true
    };
    
    // Add padding by adjusting row height - increased for more padding
    worksheet.getRow(1).height = 60; // Increased from 60 to 80 to add more padding
    
    // Style the header row (now row 2)
    worksheet.getRow(2).height = 35;
    const headerRow = worksheet.getRow(2);
    headerRow.height = 40; // Increased height for more padding
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: '000000' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
        wordwrap: true,
        indent: 2 // Adding horizontal padding
      };
    });
    
    // Add data rows with null/undefined checks
    filteredData.forEach(item => {
      worksheet.addRow({
        module: item.module || '',
        subModule: item.subModule || '',
        functionality: item.functionality || '',
        dependencyModule: item.dependencyModule || '',
        dependantFunctionality: item.dependantFunctionality || '',
        api: item.api || ''
      });
    });
    
    // Style all data cells
    for (let i = 3; i <= filteredData.length + 2; i++) {
      const row = worksheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // Set response headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=iep-dependency-matrix.xlsx');
    
    // Write to buffer first to avoid stream issues
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel file for filtered data:', error);
    res.status(500).json({ 
      message: 'Error generating Excel file for filtered data', 
      error: error.message,
      stack: error.stack 
    });
  }
});

// 2. Add matrix item endpoint (non-parameterized) - protected
app.post('/api/matrix', authenticateToken, (req, res) => {
  // Normalize the new item before adding it
  const normalizedItem = normalizeMatrixItems([req.body], moduleToSubModules)[0];
  
  const newItem = {
    id: matrixData.length > 0 ? Math.max(...matrixData.map(item => item.id)) + 1 : 1,
    ...normalizedItem
  };
  matrixData.push(newItem);
  
  // Save updated data to JSON file
  try {
    jsonData.matrixData = matrixData;
    fs.writeFileSync(dataFilePath, JSON.stringify(jsonData, null, 2));
    console.log('Data saved successfully to iepDepMtrData.json');
  } catch (error) {
    console.error('Error saving data to file:', error);
  }
  
  res.status(201).json(newItem);
});

// 3. Parameterized routes MUST come last
// Update matrix item endpoint - protected
app.put('/api/matrix/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const index = matrixData.findIndex(item => item.id === id);
  
  if (index !== -1) {
    // Create updated item 
    const updatedItem = { ...matrixData[index], ...req.body };
    
    // Normalize the item to ensure consistent casing with the module mapping
    const normalizedItem = normalizeMatrixItems([updatedItem], moduleToSubModules)[0];
    console.log('Original module value:', req.body.module);
    console.log('Normalized module value:', normalizedItem.module);
    
    // Update the item in the matrix data array
    matrixData[index] = normalizedItem;
    
    // Save updated data to JSON file
    try {
      jsonData.matrixData = matrixData;
      fs.writeFileSync(dataFilePath, JSON.stringify(jsonData, null, 2));
      console.log('Data saved successfully to iepDepMtrData.json');
      
      // Return the normalized item
      res.json(normalizedItem);
    } catch (error) {
      console.error('Error saving data to file:', error);
      res.status(500).json({ message: 'Error saving to file' });
    }
  } else {
    res.status(404).json({ message: 'Item not found' });
  }
});

// Delete matrix item endpoint - protected
app.delete('/api/matrix/:id', authenticateToken, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    console.log(`Attempting to delete item with ID: ${id}`);
    
    const index = matrixData.findIndex(item => item.id === id);
    console.log(`Item index: ${index}`);
    
    if (index !== -1) {
      const deletedItem = matrixData[index];
      matrixData.splice(index, 1);
      
      // Save updated data to JSON file
      try {
        jsonData.matrixData = matrixData;
        fs.writeFileSync(dataFilePath, JSON.stringify(jsonData, null, 2));
        console.log('Data saved successfully to iepDepMtrData.json');
      } catch (error) {
        console.error('Error saving data to file:', error);
      }
      
      console.log(`Item deleted successfully: ${JSON.stringify(deletedItem)}`);
      res.json({ message: 'Item deleted successfully', item: deletedItem });
    } else {
      console.log(`Item with ID ${id} not found`);
      res.status(404).json({ message: `Item with ID ${id} not found` });
    }
  } catch (error) {
    console.error('Error in delete endpoint:', error);
    res.status(500).json({ message: 'Server error while deleting item', error: error.message });
  }
});

// Helper function to normalize module and submodule names based on module mapping
function normalizeMatrixItems(items, moduleMapping) {
  return items.map(item => {
    const normalizedItem = {...item};
    
    // Normalize the module name if it exists
    if (normalizedItem.module) {
      // Find the matching module name in the module mapping (case insensitive)
      const matchingModuleName = Object.keys(moduleMapping).find(
        m => m.toLowerCase() === normalizedItem.module.toLowerCase()
      );
      
      // If a match is found and it's different from the current value, update it
      if (matchingModuleName && normalizedItem.module !== matchingModuleName) {
        console.log(`Normalizing module name from "${normalizedItem.module}" to "${matchingModuleName}"`);
        normalizedItem.module = matchingModuleName;
      }
      
      // Normalize the submodule if the module exists in our mapping
      if (normalizedItem.subModule && moduleMapping[normalizedItem.module]) {
        const validSubModules = moduleMapping[normalizedItem.module];
        const matchingSubModule = validSubModules.find(
          sm => sm.toLowerCase() === normalizedItem.subModule.toLowerCase()
        );
        
        if (matchingSubModule && normalizedItem.subModule !== matchingSubModule) {
          console.log(`Normalizing submodule name from "${normalizedItem.subModule}" to "${matchingSubModule}"`);
          normalizedItem.subModule = matchingSubModule;
        }
      }
    }
    
    return normalizedItem;
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Loaded ${matrixData.length} matrix items from data file`);
});
