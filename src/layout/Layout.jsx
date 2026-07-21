import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { scrollContentToTop } from '../utils/scrollToTop';

export default function Layout({ children }) {
  const location = useLocation();
  const currentSection = location.pathname.split('/')[1] || 'dashboard';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /*
   * Land every navigation at the top.
   *
   * Done on route change rather than wired to each button, so it covers every way a section
   * can be entered — sidebar links, header actions, breadcrumbs, browser back/forward, and
   * any programmatic navigate(). Wiring individual buttons would miss most of those and
   * would need re-doing for each new one.
   *
   * The page does NOT scroll the window: #content-viewport is the scroll container, so
   * window.scrollTo() is a no-op here.
   */
  useEffect(() => {
    scrollContentToTop({ smooth: false }); // instant on a route change — a new page shouldn't animate
  }, [location.pathname]);

  const isAuthenticated = !!localStorage.getItem('accessToken');

  if (currentSection === 'login' || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F1ED] text-[#4A3F35]">
        {children}
      </div>
    );
  }

  return (
    /*
     * `admin-shell` pins the shell to the viewport height (see index.css) instead of
     * `min-h-screen`.
     *
     * That distinction is the whole bug: with `min-h-screen` the container grows to fit its
     * tallest child, and the sidebar — 21 nav items, ~1100px — is taller than most laptop
     * screens. It stretched the container past the viewport, `overflow-hidden` clipped the
     * excess, and the last few nav items plus Logout became unreachable. The sidebar's own
     * `overflow-y-auto` never engaged because nothing ever constrained its height.
     *
     * Bounded to the viewport, the two scroll regions inside (sidebar nav, content) do the
     * scrolling, which is what a dashboard shell should do.
     */
    <div className="admin-shell flex overflow-hidden bg-[#F5F1ED] text-[#4A3F35]">
      <Sidebar
        currentSection={currentSection}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* min-h-0: a flex item's automatic minimum size is its content, which would let a
          long page push `main` taller than the shell and defeat the inner scroller. */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header
          currentSection={currentSection}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
        <div id="content-viewport" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
