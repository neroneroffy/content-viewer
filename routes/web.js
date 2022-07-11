const express = require('express');
const fetchWebContent = require('../controllers/fetchWebContent')
const router = express.Router();

router.post('/', fetchWebContent)

module.exports = router
