/**
 * SolveLink Dashboard Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Dashboard Sidebar Toggle
  const sidebarToggle = document.getElementById('dashboardSidebarToggle');
  const sidebar = document.getElementById('dashboardSidebar');

  if (sidebarToggle && sidebar) {
    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    sidebarToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      backdrop.classList.toggle('active', isOpen);
      sidebarToggle.setAttribute('aria-expanded', isOpen);
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
      sidebarToggle.setAttribute('aria-expanded', 'false');
    });
  }
});
