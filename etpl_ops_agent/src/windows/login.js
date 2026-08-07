'use strict';

const subtitleEl = document.getElementById('subtitle');
const credentialsStepEl = document.getElementById('credentialsStep');
const totpStepEl = document.getElementById('totpStep');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const totpEl = document.getElementById('totp');
const submitEl = document.getElementById('submit');
const backEl = document.getElementById('back');
const errorEl = document.getElementById('error');

let awaitingTotp = false;

function showTotpStep() {
  awaitingTotp = true;
  credentialsStepEl.classList.add('hidden');
  totpStepEl.classList.remove('hidden');
  backEl.classList.remove('hidden');
  submitEl.textContent = 'Verify';
  subtitleEl.textContent = 'Enter the 6-digit code from your authenticator app.';
  errorEl.textContent = '';
  totpEl.focus();
}

function showCredentialsStep() {
  awaitingTotp = false;
  credentialsStepEl.classList.remove('hidden');
  totpStepEl.classList.add('hidden');
  backEl.classList.add('hidden');
  submitEl.textContent = 'Sign in';
  subtitleEl.textContent = 'Sign in with your work account to begin.';
  totpEl.value = '';
  errorEl.textContent = '';
}

async function submit() {
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (!email || !password) {
    errorEl.textContent = 'Enter your email and password.';
    return;
  }
  if (awaitingTotp && !totpEl.value.trim()) {
    errorEl.textContent = 'Enter your 6-digit code.';
    return;
  }

  submitEl.disabled = true;
  errorEl.textContent = '';
  try {
    const res = await window.agent.login(email, password, awaitingTotp ? totpEl.value.trim() : undefined);
    if (res.twoFactorRequired) {
      showTotpStep();
      return;
    }
    window.close(); // main process opens the status window on successful login
  } catch (err) {
    errorEl.textContent = err.message || 'Sign in failed.';
  } finally {
    submitEl.disabled = false;
  }
}

submitEl.addEventListener('click', submit);
backEl.addEventListener('click', showCredentialsStep);
passwordEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
totpEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
