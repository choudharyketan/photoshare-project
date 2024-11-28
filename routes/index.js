const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const multer = require('multer');
const path = require('path');
const Photo = require('../models/Photo');

// File upload configuration
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Images Only!');
    }
  }
});

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Home Page
router.get('/', (req, res) => {
  res.render('home', { user: req.user });
});

// Public Photo Gallery
router.get('/gallery', async (req, res) => {
  try {
    const photos = await Photo.find().populate('user', 'username');
    res.render('gallery', { photos, user: req.user });
  } catch (error) {
    res.status(500).render('error', { error });
  }
});

// Search Route
router.get('/search', async (req, res) => {
  const query = req.query.q;
  try {
    const photos = await Photo.find({ 
      $text: { $search: query } 
    }).populate('user', 'username');
    res.render('gallery', { photos, query, user: req.user });
  } catch (error) {
    res.status(500).render('error', { error });
  }
});

// Authentication Routes
router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email, password });
    await user.save();
    req.login(user, (err) => {
      if (err) return res.status(500).render('error', { error: err });
      res.redirect('/dashboard');
    });
  } catch (error) {
    res.status(500).render('register', { error });
  }
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true
}));

// GitHub Authentication
router.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// Dashboard and Photo Management
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const photos = await Photo.find({ user: req.user._id });
    res.render('dashboard', { photos, user: req.user });
  } catch (error) {
    res.status(500).render('error', { error });
  }
});

router.get('/upload', isAuthenticated, (req, res) => {
  res.render('upload', { user: req.user });
});

router.post('/upload', isAuthenticated, upload.single('photo'), async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    const photo = new Photo({
      title,
      description,
      imageUrl: `/uploads/${req.file.filename}`,
      user: req.user._id,
      tags: tags.split(',').map(tag => tag.trim())
    });
    await photo.save();
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).render('upload', { error });
  }
});

router.get('/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (photo.user.toString() !== req.user._id.toString()) {
      return res.status(403).render('error', { error: 'Unauthorized' });
    }
    res.render('edit', { photo, user: req.user });
  } catch (error) {
    res.status(500).render('error', { error });
  }
});

router.post('/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    await Photo.findByIdAndUpdate(req.params.id, {
      title,
      description,
      tags: tags.split(',').map(tag => tag.trim())
    });
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).render('error', { error });
  }
});

router.post('/delete/:id', isAuthenticated, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (photo.user.toString() !== req.user._id.toString()) {
      return res.status(403).render('error', { error: 'Unauthorized' });
    }
    await Photo.findByIdAndDelete(req.params.id);
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).render('error', { error });
  }
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).render('error', { error: err });
    res.redirect('/');
  });
});

module.exports = router;