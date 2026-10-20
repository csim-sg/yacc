import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Header } from '../header/header';
import { Navigation } from '../navigation/navigation';

/**
 * Authenticated app shell (React `MainLayout` port — W2/W23).
 *
 * The shared layout for every authenticated feature route: the mobile
 * overlay, the role-filtered `Navigation` sidebar (drawer state owned
 * here), the `Header` (which mounts the `NotificationCenter` once —
 * reachable on every authenticated route), and the routed page content.
 * Public/auth routes live outside this component and render no shell.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Header, Navigation],
  templateUrl: './app-shell.html',
})
export class AppShell {
  /** Mobile drawer state (React `MainLayout` `sidebarOpen`). */
  protected readonly sidebarOpen = signal(false);
}
