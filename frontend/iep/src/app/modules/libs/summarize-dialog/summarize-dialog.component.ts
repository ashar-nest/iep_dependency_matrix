import { Component, Inject, InjectionToken, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SummaryViewerComponent } from '../summary-viewer/summary-viewer.component';

// Interface for dialog data
interface DialogData {
  title: string;
  summaryPath?: string;
}

// Custom token for our dialog reference
export const DIALOG_REF = new InjectionToken<any>('DialogRef');

@Component({
  selector: 'app-summarize-dialog',
  templateUrl: './summarize-dialog.component.html',
  styleUrls: ['./summarize-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, SummaryViewerComponent]
})
export class SummarizeDialogComponent {
  title: string;
  summaryPath: string;
  
  constructor(
    @Optional() @Inject(DIALOG_REF) public dialogRef: any,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData | null
  ) {
    console.log('SummarizeDialogComponent constructed with data:', data);
    this.title = data?.title || 'Dependency Matrix Summary';
    this.summaryPath = data?.summaryPath || 'assets/summary.html';
  }
  
  closeDialog(): void {
    if (this.dialogRef && typeof this.dialogRef.close === 'function') {
      this.dialogRef.close();
    }
  }
}