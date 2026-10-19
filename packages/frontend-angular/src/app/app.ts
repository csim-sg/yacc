import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { installRealtimeDevtools } from './lib/realtime-devtools';
import { ReconnectingIndicator } from './components/reconnecting-indicator';
import { RealtimeBindingService } from './services/realtime-binding.service';

/**
 * App root (React `App.tsx` root parity): mounts the router outlet
 * (public routes render directly; the authenticated route group renders
 * the `AppShell` layout) and the W19 reconnecting indicator, and starts
 * the real-time binding once (single socket entry — the binding
 * registers the fixed inbound listener set and connects when a session
 * token exists; React parity: the root owns `connect()` + the global
 * indicator).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReconnectingIndicator],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly realtime = inject(RealtimeBindingService);

  constructor() {
    this.realtime.start();
    // Dev-only observation seam for the shared harness (no-op in prod).
    installRealtimeDevtools();
  }
}
