const express = require('express');
const router = express.Router();

router.get('/tally', function(req, res, next) {
    res.render('tally', { title: 'Tally' });
});

module.exports = router;