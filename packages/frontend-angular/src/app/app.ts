import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { installRealtimeDevtools } from './lib/realtime-devtools';
import { ReconnectingIndicator } from './components/reconnecting-indicator';
import { RealtimeBindingService } from './services/realtime-binding.service';

/**
 * App shell (React `App.tsx` port): mounts the router outlet and the
 * W19 reconnecting indicator, and starts the real-time binding once
 * (single socket entry — the binding registers the fixed inbound
 * listener set and connects when a session token exists; React parity:
 * the root owns `connect()` + the global indicator).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReconnectingIndicator],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('YACC — Yet Another Chat Client');

  private readonly realtime = inject(RealtimeBindingService);

  constructor() {
    this.realtime.start();
    // Dev-only observation seam for the shared harness (no-op in prod).
    installRealtimeDevtools();
  }
}
