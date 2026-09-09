// ==========================================================================
// NexTerm — Modern Navigation Subsystem
// Categorized developer navigation and collapsible sidebar per Modern UI/UX Plan
// ==========================================================================

let isSidebarCollapsed = false;
let currentActiveSection = "sessions";

export function initModernNavigation(callbacks = {}) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  // Setup collapse toggle button if not present
  let collapseBtn = document.getElementById("sidebarCollapseToggle");
  if (!collapseBtn) {
    collapseBtn = document.createElement("button");
    collapseBtn.id = "sidebarCollapseToggle";
    collapseBtn.className = "sidebar-collapse-toggle";
    collapseBtn.title = "Toggle Sidebar Collapse (Ctrl+B)";
    collapseBtn.innerHTML = `◀`;
    sidebar.appendChild(collapseBtn);

    collapseBtn.addEventListener("click", () => {
      toggleSidebarCollapse();
    });
  }

  // Bind categorized nav item buttons
  document.querySelectorAll(".nav-category-item").forEach(item => {
    item.addEventListener("click", () => {
      const section = item.dataset.section;
      if (section) {
        setActiveNavSection(section, callbacks);
      }
    });
  });

  // Responsive layout listener
  window.addEventListener("resize", () => {
    if (window.innerWidth < 850 && !isSidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  });

  if (window.innerWidth < 850) {
    setSidebarCollapsed(true);
  }
}

export function toggleSidebarCollapse() {
  setSidebarCollapsed(!isSidebarCollapsed);
}

export function setSidebarCollapsed(collapsed) {
  isSidebarCollapsed = collapsed;
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarCollapseToggle");
  if (!sidebar) return;

  sidebar.classList.toggle("collapsed", isSidebarCollapsed);
  if (toggleBtn) {
    toggleBtn.innerHTML = isSidebarCollapsed ? `▶` : `◀`;
    toggleBtn.title = isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar";
  }

  // Refit terminal panes after sidebar transitions
  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 160);
}

export function setActiveNavSection(section, callbacks = {}) {
  currentActiveSection = section;

  document.querySelectorAll(".nav-category-item").forEach(item => {
    item.classList.toggle("active", item.dataset.section === section);
  });

  // Route to corresponding callback/view
  switch (section) {
    case "home":
      if (callbacks.onOpenHome) callbacks.onOpenHome();
      break;
    case "sessions":
      if (callbacks.onOpenSessions) callbacks.onOpenSessions();
      break;
    case "sftp":
      if (callbacks.onOpenSFTP) callbacks.onOpenSFTP();
      break;
    case "broadcast":
      if (callbacks.onOpenBroadcast) callbacks.onOpenBroadcast();
      break;
    case "multiexec":
      if (callbacks.onOpenMultiExec) callbacks.onOpenMultiExec();
      break;
    case "tunneling":
      if (callbacks.onOpenTunneling) callbacks.onOpenTunneling();
      break;
    case "settings":
      if (callbacks.onOpenSettings) callbacks.onOpenSettings();
      break;
    default:
      break;
  }
}
