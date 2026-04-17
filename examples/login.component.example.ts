import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, Contact } from '@ces/messaging';

/**
 * LOGIN COMPONENT EXAMPLE
 * 
 * This shows how to initialize the messaging system after your user logs in.
 * The key is to call messagingAuth.setSession() with the session_gid and contact info.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>Login</h1>
        
        <form (ngSubmit)="onLogin()" #loginForm="ngForm">
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              id="email"
              type="email" 
              [(ngModel)]="email" 
              name="email"
              placeholder="user@example.com" 
              required
              [disabled]="isLoading">
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input 
              id="password"
              type="password" 
              [(ngModel)]="password" 
              name="password"
              placeholder="••••••••" 
              required
              [disabled]="isLoading">
          </div>
          
          <div class="error-message" *ngIf="errorMessage">
            {{ errorMessage }}
          </div>
          
          <button 
            type="submit" 
            [disabled]="isLoading || !loginForm.valid"
            class="login-button">
            {{ isLoading ? 'Logging in...' : 'Login' }}
          </button>
        </form>
        
        <div class="demo-info">
          <p>Demo credentials:</p>
          <ul>
            <li>Email: demo@example.com</li>
            <li>Password: demo123</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    
    .login-card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
    }
    
    h1 {
      margin: 0 0 30px 0;
      color: #1f2937;
      font-size: 28px;
      font-weight: 700;
      text-align: center;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    label {
      display: block;
      margin-bottom: 8px;
      color: #374151;
      font-weight: 500;
      font-size: 14px;
    }
    
    input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    
    input:disabled {
      background: #f3f4f6;
      cursor: not-allowed;
    }
    
    .error-message {
      background: #fee2e2;
      color: #dc2626;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    
    .login-button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .login-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }
    
    .login-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .demo-info {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 13px;
    }
    
    .demo-info p {
      margin: 0 0 10px 0;
      font-weight: 600;
    }
    
    .demo-info ul {
      margin: 0;
      padding-left: 20px;
    }
    
    .demo-info li {
      margin: 5px 0;
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private messagingAuth: AuthService  // Inject messaging auth service
  ) {}

  async onLogin() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // ============================================
      // STEP 1: Authenticate with YOUR auth system
      // ============================================
      // Replace this with your actual authentication logic
      const authResponse = await this.authenticateWithYourBackend(
        this.email, 
        this.password
      );

      // ============================================
      // STEP 2: Extract session and user data
      // ============================================
      const sessionGid = authResponse.session_gid;
      const userId = authResponse.user_id || authResponse.contact_id || this.email;
      const userName = authResponse.name || authResponse.username || this.email.split('@')[0];
      const companyName = authResponse.company_name || 'Your Company';
      const firstName = authResponse.first_name || userName.split(' ')[0];
      const lastName = authResponse.last_name || userName.split(' ').slice(1).join(' ');

      // ============================================
      // STEP 3: Create contact object for messaging
      // ============================================
      const contact: Contact = {
        contact_id: userId.toString(),
        user_gid: sessionGid,
        username: userName,
        first_name: firstName,
        last_name: lastName,
        email: this.email,
        company_name: companyName,
        profile_image_url: authResponse.profile_image_url,
        phone: authResponse.phone,
        is_active: true
      };

      // ============================================
      // STEP 4: Initialize messaging session
      // ============================================
      // This is the KEY step - it activates the messaging system
      this.messagingAuth.setSession(sessionGid, contact);

      console.log('✅ Messaging session initialized:', {
        sessionGid,
        contactId: contact.contact_id,
        email: contact.email
      });

      // ============================================
      // STEP 5: Navigate to your app
      // ============================================
      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      console.error('❌ Login failed:', error);
      this.errorMessage = error.message || 'Login failed. Please check your credentials.';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * EXAMPLE: Authenticate with your backend
   * Replace this with your actual authentication API call
   */
  private async authenticateWithYourBackend(email: string, password: string): Promise<any> {
    // Example using HttpClient
    return this.http.post<any>('https://your-api.com/auth', {
      function: '_login',
      email,
      password
    }).toPromise();

    // OR if your API uses different format:
    // return this.http.post<any>('https://your-api.com/login', {
    //   email,
    //   password
    // }).toPromise();
  }

  /**
   * ALTERNATIVE: Use the messaging library's built-in login
   * (Only works if your backend uses the same auth format)
   */
  private async loginWithMessagingAuth(email: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.messagingAuth.login(email, password).subscribe({
        next: (authSession) => {
          // Session is automatically set by the auth service
          console.log('✅ Logged in with messaging auth:', authSession);
          resolve();
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }
}
