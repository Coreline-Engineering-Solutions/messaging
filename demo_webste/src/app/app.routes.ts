import { Routes } from '@angular/router';
import { MessagingTestPageComponent } from './messaging-test-page.component';

export const routes: Routes = [
  {
    path: 'alice',
    component: MessagingTestPageComponent,
    data: { email: 'danielmitchell8204@gmail.com', side: 'left', expectedContactId: '19' },
  },
  {
    path: 'daniel',
    component: MessagingTestPageComponent,
    data: { email: 'daniel.mitchell@corelineengineering.com', side: 'right', expectedContactId: '22' },
  },
  { path: '', pathMatch: 'full', redirectTo: 'alice' },
];
