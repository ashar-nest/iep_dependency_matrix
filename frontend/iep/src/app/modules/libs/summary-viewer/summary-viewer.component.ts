import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-summary-viewer',
  templateUrl: './summary-viewer.component.html',
  styleUrls: ['./summary-viewer.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class SummaryViewerComponent implements OnInit {
  @Input() summaryPath: string = 'assets/summary.html';
  summaryUrl!: SafeResourceUrl; // Using definite assignment assertion
  
  constructor(private sanitizer: DomSanitizer) {
    // Default initialization
  }

  ngOnInit(): void {
    // Sanitize the URL for security
    this.summaryUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.summaryPath);
  }
}