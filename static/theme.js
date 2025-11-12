// Theme toggle logic
function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
}

// Restore theme on load
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('theme') || 'dark';
  setTheme(saved);
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleTheme);
});
