export interface NavigationItem {
  label: string;
  href: string;
  pinToBottom?: boolean;
}

const sidebarNavigation: NavigationItem[] = [
  { label: 'Home', href: '/home' },
  { label: 'Browse', href: '/product_browse' },
  { label: 'Basket', href: '/basket' },
  { label: 'History', href: '/order_history' },
  { label: 'Login', href: '/login', pinToBottom: true },
];

export default sidebarNavigation;
