import { Routes } from '@angular/router';
import { ConsoleComponent } from './pages/console/console';

export const routes: Routes = [
  { path: '', component: ConsoleComponent },
  { path: '**', redirectTo: '' },
];
