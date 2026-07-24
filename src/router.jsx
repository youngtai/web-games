import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { AsteroidsPage } from './pages/AsteroidsPage.jsx';
import { BangBangPage } from './pages/BangBangPage.jsx';
import { ImmunePage } from './pages/ImmunePage.jsx';
import { LizardLunchPage } from './pages/LizardLunchPage.jsx';
import { PortalPage } from './pages/PortalPage.jsx';
import { StarCatcherPage } from './pages/StarCatcherPage.jsx';
import { StickerBookPage } from './pages/StickerBookPage.jsx';

function RootLayout() {
  return <Outlet />;
}

function NotFoundPage() {
  return (
    <main className="portal-shell portal-shell--centered">
      <section className="not-found-panel" aria-labelledby="missing-route-title">
        <p className="eyebrow">Route missing</p>
        <h1 id="missing-route-title">No game lives here.</h1>
        <p>Choose a game from the arcade shelf.</p>
        <Link className="button button--primary" to="/">
          Back to games
        </Link>
      </section>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PortalPage,
});

const asteroidsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/asteroids',
  component: AsteroidsPage,
});

const bangBangRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/bang-bang',
  component: BangBangPage,
});

const starCatcherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/star-catcher',
  component: StarCatcherPage,
});

const stickerBookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/sticker-book',
  component: StickerBookPage,
});

const lizardLunchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/lizard-lunch',
  component: LizardLunchPage,
});

const immuneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/immune',
  component: ImmunePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  asteroidsRoute,
  bangBangRoute,
  starCatcherRoute,
  stickerBookRoute,
  lizardLunchRoute,
  immuneRoute,
]);

export const router = createRouter({ routeTree });
