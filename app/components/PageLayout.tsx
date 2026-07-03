import {AnnouncementBar} from '~/components/AnnouncementBar';
import {Header} from '~/components/Header';
import {Footer} from '~/components/Footer';
import {CartDrawer} from '~/components/CartDrawer';
import {MobileMenu} from '~/components/MobileMenu';
import type {MegaCollection} from '~/components/MegaMenu';

interface PageLayoutProps {
  collections?: MegaCollection[];
  isLoggedIn?: Promise<boolean>;
  children?: React.ReactNode;
}

export function PageLayout({
  collections = [],
  isLoggedIn,
  children = null,
}: PageLayoutProps) {
  return (
    <>
      <AnnouncementBar />
      <Header collections={collections} isLoggedIn={isLoggedIn} />
      <div className="page">{children}</div>
      <Footer collections={collections} />
      <CartDrawer />
      <MobileMenu collections={collections} />
    </>
  );
}
