import { Component, Inject, InjectionToken, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

// Interface for dialog data
interface DialogData {
  title: string;
}

// Custom token for our dialog reference (reuse the same token from summarize-dialog)
import { DIALOG_REF } from '../summarize-dialog/summarize-dialog.component';

@Component({
  selector: 'app-module-details-dialog',
  templateUrl: './module-details-dialog.component.html',
  styleUrls: ['./module-details-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ModuleDetailsDialogComponent {
  title: string;
  
  constructor(
    @Optional() @Inject(DIALOG_REF) public dialogRef: any,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DialogData | null
  ) {
    console.log('ModuleDetailsDialogComponent constructed with data:', data);
    this.title = data?.title || 'Module Details';
  }
  
  closeDialog(): void {
    if (this.dialogRef && typeof this.dialogRef.close === 'function') {
      this.dialogRef.close();
    }
  }
}