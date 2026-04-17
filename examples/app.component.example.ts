import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MessagingOverlayComponent } from '@ces/messaging';

/**
 * ROOT APP COMPONENT
 * 
 * This is your main app component. The MessagingOverlayComponent
 * should be added here so it's available globally across all routes.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MessagingOverlayComponent  // Import the messaging overlay
  ],
  template: `
    <!-- Your main app content -->
    <router-outlet></router-outlet>
    
    <!-- 
      Messaging overlay - floats above everything
      Only shows when user is authenticated
      Includes floating button and chat panel
    -->
    <app-messaging-overlay></app-messaging-overlay>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `]
})
export class AppComponent {
  title = 'your-app';
}
