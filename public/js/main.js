/**
 * SolveLink Global JavaScript
 * Handles responsive navigation, mobile sidebar drawer, and UI interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Drawer Toggle
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const mobileDrawer = document.getElementById('mobileNavDrawer');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
      
      // Update hamburger icon appearance
      const menuIcon = mobileToggle.querySelector('.menu-icon');
      const closeIcon = mobileToggle.querySelector('.close-icon');
      if (menuIcon && closeIcon) {
        menuIcon.style.display = isOpen ? 'none' : 'block';
        closeIcon.style.display = isOpen ? 'block' : 'none';
      }
    });

    // Close on backdrop / outside click
    document.addEventListener('click', (e) => {
      if (mobileDrawer.classList.contains('open') && 
          !mobileDrawer.contains(e.target) && 
          !mobileToggle.contains(e.target)) {
        mobileDrawer.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Mobile Dashboard Sidebar Toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('dashboardSidebar');
  let sidebarBackdrop = document.getElementById('sidebarBackdrop');

  if (sidebarToggle && sidebar) {
    if (!sidebarBackdrop) {
      sidebarBackdrop = document.createElement('div');
      sidebarBackdrop.id = 'sidebarBackdrop';
      sidebarBackdrop.className = 'sidebar-backdrop';
      document.body.appendChild(sidebarBackdrop);
    }

    const toggleSidebar = (open) => {
      sidebar.classList.toggle('open', open);
      sidebarBackdrop.classList.toggle('active', open);
      sidebarToggle.setAttribute('aria-expanded', open);
    };

    sidebarToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('open');
      toggleSidebar(!isOpen);
    });

    sidebarBackdrop.addEventListener('click', () => {
      toggleSidebar(false);
    });
  }

  // Universal & Accessible Password Visibility Toggle
  function initPasswordToggles() {
    // 1. Initialize all existing declarative password toggle buttons
    const toggleButtons = document.querySelectorAll('.password-toggle-btn');
    
    toggleButtons.forEach(btn => {
      if (btn.dataset.initialized === 'true') return;
      btn.dataset.initialized = 'true';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const wrapper = btn.closest('.password-input-wrapper') || btn.parentElement;
        const input = wrapper ? wrapper.querySelector('input') : null;
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const eyeShow = btn.querySelector('.eye-show');
        const eyeHide = btn.querySelector('.eye-hide');

        if (eyeShow && eyeHide) {
          eyeShow.style.display = isPassword ? 'none' : 'block';
          eyeHide.style.display = isPassword ? 'block' : 'none';
        }

        const newLabel = isPassword ? 'Hide password' : 'Show password';
        btn.setAttribute('aria-label', newLabel);
        btn.setAttribute('title', newLabel);
        btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
      });
    });

    // 2. Auto-enhance any standalone password input if not already wrapped
    const nakedPasswordInputs = document.querySelectorAll('input[type="password"]:not(.password-toggle-ready)');
    nakedPasswordInputs.forEach(input => {
      if (input.closest('.password-input-wrapper')) {
        input.classList.add('password-toggle-ready');
        return;
      }

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'password-input-wrapper';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      input.classList.add('password-toggle-ready');

      // Create button
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'password-toggle-btn';
      btn.setAttribute('aria-label', 'Show password');
      btn.setAttribute('title', 'Show password');
      btn.setAttribute('aria-pressed', 'false');
      if (input.id) btn.setAttribute('aria-controls', input.id);
      
      btn.innerHTML = `
        <svg class="eye-icon eye-show" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg class="eye-icon eye-hide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display: none;">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;

      btn.dataset.initialized = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const eyeShow = btn.querySelector('.eye-show');
        const eyeHide = btn.querySelector('.eye-hide');
        if (eyeShow && eyeHide) {
          eyeShow.style.display = isPassword ? 'none' : 'block';
          eyeHide.style.display = isPassword ? 'block' : 'none';
        }

        const newLabel = isPassword ? 'Hide password' : 'Show password';
        btn.setAttribute('aria-label', newLabel);
        btn.setAttribute('title', newLabel);
        btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
      });

      wrapper.appendChild(btn);
    });
  }

  // Initialize password toggles on page load
  initPasswordToggles();

  // ==========================================
  // Native SolveLink Logout Confirmation Modal
  // ==========================================
  const logoutModal = document.getElementById('logoutConfirmModal');
  const btnCancelLogout = document.getElementById('btnCancelLogout');
  const logoutConfirmForm = document.getElementById('logoutConfirmForm');
  const btnConfirmLogout = document.getElementById('btnConfirmLogout');

  const openLogoutModal = (e) => {
    if (e) e.preventDefault();
    if (logoutModal) {
      logoutModal.style.display = 'flex';
      logoutModal.classList.add('active');
    }
  };

  const closeLogoutModal = () => {
    if (logoutModal) {
      logoutModal.style.display = 'none';
      logoutModal.classList.remove('active');
    }
  };

  // Bind exclusively to logout triggers outside the modal
  document.querySelectorAll('.btn-logout-trigger, [data-logout-trigger="true"]').forEach(btn => {
    btn.addEventListener('click', openLogoutModal);
  });

  if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', (e) => {
      e.preventDefault();
      closeLogoutModal();
    });
  }

  // Prevent multiple logout clicks during submission
  if (logoutConfirmForm) {
    logoutConfirmForm.addEventListener('submit', () => {
      if (btnConfirmLogout) {
        btnConfirmLogout.disabled = true;
        btnConfirmLogout.innerText = 'Logging out...';
      }
    });
  } else if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', () => {
      btnConfirmLogout.innerText = 'Logging out...';
    });
  }

  if (logoutModal) {
    logoutModal.addEventListener('click', (e) => {
      if (e.target === logoutModal) closeLogoutModal();
    });
  }

  // Global Keydown Handler (e.g., ESC to close modals/drawers)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (mobileDrawer && mobileDrawer.classList.contains('open')) {
        mobileDrawer.classList.remove('open');
        if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
      }
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
      }
      closeLogoutModal();
    }
  });
});
