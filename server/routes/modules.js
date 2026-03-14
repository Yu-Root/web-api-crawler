const express = require('express');
const router = express.Router();
const Module = require('../database/models/Module');
const Request = require('../database/models/Request');
const docGenerator = require('../services/docGenerator');
const dependencyAnalyzer = require('../services/dependencyAnalyzer');
const classifier = require('../services/classifier');

// Get all modules
router.get('/', async (req, res) => {
  try {
    const modules = await Module.findAll({
      include: [{
        model: Request,
        as: 'requests',
        attributes: ['id']
      }],
      order: [['created_at', 'DESC']]
    });

    const modulesWithCount = modules.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      created_at: m.created_at,
      updated_at: m.updated_at,
      request_count: m.requests ? m.requests.length : 0
    }));

    res.json({ success: true, modules: modulesWithCount });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new module
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Module name is required' });
    }

    const module = await Module.create({ name, description });

    res.json({ success: true, module });
  } catch (error) {
    console.error('Error creating module:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ success: false, error: 'Module name already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Get module details with requests (full data - no need to call getRequestDetails)
router.get('/getById', async (req, res) => {
  try {
    const { id } = req.query;
    const moduleId = parseInt(id, 10);

    if (isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid module ID' });
    }

    const module = await Module.findByPk(moduleId, {
      include: [{
        model: Request,
        as: 'requests'
        // Return all fields including headers, post_data, response_body, etc.
      }]
    });

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    res.json({ success: true, module });
  } catch (error) {
    console.error('Error fetching module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single request details (full info)
router.get('/getRequestDetails', async (req, res) => {
  try {
    const { id } = req.query;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return res.status(400).json({ success: false, error: 'Invalid request ID' });
    }

    const request = await Request.findByPk(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    res.json({ success: true, request });
  } catch (error) {
    console.error('Error fetching request details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete module
router.delete('/deleteById', async (req, res) => {
  try {
    const { id } = req.query;
    const moduleId = parseInt(id, 10);

    if (isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid module ID' });
    }

    const module = await Module.findByPk(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // Delete associated requests first
    await Request.destroy({ where: { module_id: moduleId } });
    await module.destroy();

    res.json({ success: true, message: 'Module deleted successfully' });
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add requests to module
router.post('/addRequests', async (req, res) => {
  try {
    const { id } = req.query;
    const moduleId = parseInt(id, 10);
    const { requests } = req.body;

    if (isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid module ID' });
    }

    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({ success: false, error: 'Requests array is required' });
    }

    const module = await Module.findByPk(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const requestData = requests.map(req => ({
      module_id: moduleId,
      url: req.url,
      method: req.method,
      headers: req.headers || null,
      post_data: req.postData || null,
      resource_type: req.resourceType || null,
      timestamp: req.timestamp || null,
      status: req.status || null,
      response_body: req.responseBody || null,
      response_headers: req.responseHeaders || null,
      error: req.error || null
    }));

    const createdRequests = await Request.bulkCreate(requestData);

    res.json({ success: true, requests: createdRequests });
  } catch (error) {
    console.error('Error adding requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete request from module
router.delete('/removeRequest', async (req, res) => {
  try {
    const { moduleId, requestId } = req.query;

    const request = await Request.findOne({
      where: { id: requestId, module_id: moduleId }
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    await request.destroy();

    res.json({ success: true, message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import module data
router.post('/import', async (req, res) => {
  try {
    const { module, requests } = req.body;

    if (!module || !module.name) {
      return res.status(400).json({ success: false, error: 'Module name is required' });
    }

    // Check if module exists
    let existingModule = await Module.findOne({ where: { name: module.name } });

    if (existingModule) {
      // Delete existing requests if module exists
      await Request.destroy({ where: { module_id: existingModule.id } });
    } else {
      // Create new module
      existingModule = await Module.create({
        name: module.name,
        description: module.description || null
      });
    }

    // Create requests
    if (requests && Array.isArray(requests)) {
      const requestData = requests.map(req => ({
        module_id: existingModule.id,
        url: req.url || '',
        method: req.method || 'GET',
        headers: req.headers || null,
        post_data: req.postData || req.post_data || null,
        resource_type: req.resourceType || req.resource_type || null,
        timestamp: req.timestamp || null,
        status: req.status || null,
        response_body: req.responseBody || req.response_body || null,
        response_headers: req.responseHeaders || req.response_headers || null,
        error: req.error || null
      }));

      await Request.bulkCreate(requestData);
    }

    const updatedModule = await Module.findByPk(existingModule.id, {
      include: [{ model: Request, as: 'requests' }]
    });

    res.json({ success: true, module: updatedModule });
  } catch (error) {
    console.error('Error importing module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export module data
router.get('/exportData', async (req, res) => {
  try {
    const { id } = req.query;
    const moduleId = parseInt(id, 10);

    if (isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid module ID' });
    }

    const module = await Module.findByPk(moduleId, {
      include: [{ model: Request, as: 'requests' }]
    });

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const exportData = {
      module: {
        name: module.name,
        description: module.description,
        created_at: module.created_at,
        updated_at: module.updated_at
      },
      requests: module.requests.map(req => ({
        url: req.url,
        method: req.method,
        headers: req.headers,
        postData: req.post_data,
        resourceType: req.resource_type,
        timestamp: req.timestamp,
        status: req.status,
        responseBody: req.response_body,
        responseHeaders: req.response_headers,
        error: req.error
      }))
    };

    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Error exporting module:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search requests
router.get('/search', async (req, res) => {
  try {
    const { q, mode } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const searchQuery = `%${q}%`;
    let whereClause = {};

    if (mode === 'url') {
      whereClause = { url: { [require('sequelize').Op.like]: searchQuery } };
    } else if (mode === 'header') {
      whereClause = {
        [require('sequelize').Op.or]: [
          { headers: { [require('sequelize').Op.like]: searchQuery } },
          { response_headers: { [require('sequelize').Op.like]: searchQuery } }
        ]
      };
    } else if (mode === 'request-response') {
      whereClause = {
        [require('sequelize').Op.or]: [
          { post_data: { [require('sequelize').Op.like]: searchQuery } },
          { response_body: { [require('sequelize').Op.like]: searchQuery } }
        ]
      };
    } else {
      // Default: search everywhere
      whereClause = {
        [require('sequelize').Op.or]: [
          { url: { [require('sequelize').Op.like]: searchQuery } },
          { post_data: { [require('sequelize').Op.like]: searchQuery } },
          { response_body: { [require('sequelize').Op.like]: searchQuery } }
        ]
      };
    }

    const requests = await Request.findAll({
      where: whereClause,
      include: [{ model: Module, as: 'module', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 100
    });

    res.json({ success: true, requests, total: requests.length });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate API documentation for a module
router.get('/apidoc', async (req, res) => {
  try {
    const { id } = req.query;
    const moduleId = parseInt(id, 10);

    if (isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid module ID' });
    }

    const module = await Module.findByPk(moduleId, {
      include: [{ model: Request, as: 'requests' }]
    });

    if (!module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    const result = await docGenerator.generateApiDocs(
      { name: module.name, description: module.description },
      module.requests.map(r => ({
        url: r.url,
        method: r.method,
        headers: r.headers,
        post_data: r.post_data,
        status: r.status,
        response_body: r.response_body,
        response_headers: r.response_headers
      }))
    );

    res.json({ success: true, openApi: result.openApi, files: result.files });
  } catch (error) {
    console.error('Error generating API doc:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze dependencies for a module
router.get('/dependencies', async (req, res) => {
  try {
    const { id } = req.query;
    const moduleId = parseInt(id, 10);

    if (isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid module ID' });
    }

    const requests = await Request.findAll({
      where: { module_id: moduleId },
      order: [['timestamp', 'ASC']]
    });

    const graph = dependencyAnalyzer.analyzeDependencies(requests.map(r => ({
      id: r.id,
      url: r.url,
      method: r.method,
      status: r.status,
      timestamp: r.timestamp,
      resourceType: r.resource_type,
      post_data: r.post_data,
      response_body: r.response_body
    })));

    res.json({ success: true, graph });
  } catch (error) {
    console.error('Error analyzing dependencies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Classify requests in a module
router.post('/classify', async (req, res) => {
  try {
    const { id } = req.query;
    const moduleId = parseInt(id, 10);

    if (isNaN(moduleId)) {
      return res.status(400).json({ success: false, error: 'Invalid module ID' });
    }

    const requests = await Request.findAll({
      where: { module_id: moduleId }
    });

    const classifiedRequests = classifier.classifyRequests(requests.map(r => ({
      id: r.id,
      url: r.url,
      method: r.method,
      status: r.status,
      resourceType: r.resource_type,
      postData: r.post_data,
      responseBody: r.response_body
    })));

    for (const req of classifiedRequests) {
      await Request.update(
        { tags: req.tags, category: req.category },
        { where: { id: req.id } }
      );
    }

    res.json({ 
      success: true, 
      message: `Classified ${classifiedRequests.length} requests`,
      categories: classifier.getCategories(requests)
    });
  } catch (error) {
    console.error('Error classifying requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available tags
router.get('/tags', async (req, res) => {
  try {
    const { id } = req.query;
    
    if (id) {
      const moduleId = parseInt(id, 10);
      const requests = await Request.findAll({
        where: { module_id: moduleId }
      });
      const tags = classifier.getAvailableTags(requests.map(r => ({
        url: r.url,
        method: r.method,
        status: r.status,
        resourceType: r.resource_type,
        postData: r.post_data,
        responseBody: r.response_body
      })));
      res.json({ success: true, tags });
    } else {
      const allTags = new Set();
      const requests = await Request.findAll({
        where: { tags: { [require('sequelize').Op.ne]: null } }
      });
      requests.forEach(r => {
        if (r.tags && Array.isArray(r.tags)) {
          r.tags.forEach(t => allTags.add(t));
        }
      });
      res.json({ success: true, tags: Array.from(allTags).sort() });
    }
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
