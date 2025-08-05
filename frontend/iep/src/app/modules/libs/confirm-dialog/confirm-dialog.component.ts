import { Component, Inject, InjectionToken, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef } from '../../../services/dialog.service';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

// Import the DIALOG_REF token from summarize-dialog to reuse it
import { DIALOG_REF } from '../summarize-dialog/summarize-dialog.component';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ]
})
export class ConfirmDialogComponent {
  data: {
    title: string;
    message: string;
    confirmButton: string;
  };

  constructor(
    @Optional() @Inject(DIALOG_REF) public dialogRef: DialogRef,
    @Optional() @Inject(MAT_DIALOG_DATA) data: any
  ) {
    this.data = data || { title: '', message: '', confirmButton: 'Confirm' };
    console.log('ConfirmDialog initialized with data:', this.data);
    console.log(this.data);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}