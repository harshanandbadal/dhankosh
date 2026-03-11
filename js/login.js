/* =========================================================
   LOGIN PAGE SCRIPT
   Handles login form submission and authentication
   ========================================================= */

'use strict';

// Check for newly registered user details and pre-fill email
document.addEventListener('DOMContentLoaded', function () {
    const newUserEmail = localStorage.getItem('newUserEmail');
    if (newUserEmail) {
        document.getElementById('email').value = newUserEmail;
        localStorage.removeItem('newUserEmail');
        localStorage.removeItem('newUsername');

        // Show success message from signup
        const messageEl = document.getElementById('loginMessage');
        messageEl.className = 'form-message success';
        messageEl.textContent = 'Account created! Please login.';
        messageEl.style.display = 'block';
    }

    // If already logged in, redirect to dashboard
    const token = localStorage.getItem('authToken');
    if (token && token.startsWith('eyJ')) {
        window.location.href = 'dashboard.html';
    }
});

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('loginMessage');
    const submitBtn = this.querySelector('button[type="submit"]');

    // Basic client-side validation
    if (!email || !password) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'All fields are required';
        messageEl.style.display = 'block';
        return;
    }

    if (!email.includes('@')) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Invalid email format';
        messageEl.style.display = 'block';
        return;
    }

    if (password.length < 6) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Password must be at least 6 characters';
        messageEl.style.display = 'block';
        return;
    }

    // Show connecting state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';
    messageEl.className = 'form-message';
    messageEl.textContent = '[ CONNECTING TO SERVER... ]';
    messageEl.style.display = 'block';
    messageEl.style.color = 'var(--accent-cyan)';
    messageEl.style.borderColor = 'var(--accent-cyan)';
    messageEl.style.background = 'rgba(0, 229, 255, 0.08)';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            messageEl.className = 'form-message error';
            messageEl.textContent = data.details ? `${data.error} Details: ${data.details}` : (data.error || 'Login failed');
            messageEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Authenticate';
            return;
        }

        // Store real JWT token and user info
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('email', data.email);

        // Success
        messageEl.className = 'form-message success';
        messageEl.textContent = '[ AUTHENTICATED ] Redirecting to terminal...';
        messageEl.style.display = 'block';

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (err) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Connection error. Is the server running? (node backend/server.js)';
        messageEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Authenticate';
    }
});
