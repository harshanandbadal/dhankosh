/* =========================================================
   SIGNUP PAGE SCRIPT
   Handles signup form submission and account registration
   ========================================================= */

'use strict';

// Check if already logged in and redirect to dashboard
document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('authToken');
    if (token && token.startsWith('eyJ')) {
        window.location.href = 'dashboard.html';
    }
});

// Handle signup form submission
document.getElementById('signupForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageEl = document.getElementById('signupMessage');
    const submitBtn = this.querySelector('button[type="submit"]');

    // Client-side validation
    if (!fullname || !email || !password || !confirmPassword) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'All fields are required';
        messageEl.style.display = 'block';
        return;
    }

    if (fullname.length < 3) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Full name must be at least 3 characters';
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

    if (password !== confirmPassword) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Passwords do not match';
        messageEl.style.display = 'block';
        return;
    }

    // Show connecting state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
    messageEl.className = 'form-message';
    messageEl.textContent = '[ CONNECTING TO SERVER... ]';
    messageEl.style.display = 'block';
    messageEl.style.color = 'var(--accent-cyan)';
    messageEl.style.borderColor = 'var(--accent-cyan)';
    messageEl.style.background = 'rgba(0, 229, 255, 0.08)';

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: fullname, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            messageEl.className = 'form-message error';
            messageEl.textContent = data.details ? `${data.error} Details: ${data.details}` : (data.error || 'Registration failed');
            messageEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register Account';
            return;
        }

        // Store email for auto-fill on login page
        localStorage.setItem('newUserEmail', email);

        // Success
        messageEl.className = 'form-message success';
        messageEl.textContent = '[ ACCOUNT CREATED ] Redirecting to login...';
        messageEl.style.display = 'block';

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);

    } catch (err) {
        messageEl.className = 'form-message error';
        messageEl.textContent = 'Connection error. Is the server running? (node backend/server.js)';
        messageEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Account';
    }
});
