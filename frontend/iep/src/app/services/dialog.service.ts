import { Injectable, ComponentRef, ApplicationRef, createComponent, Type, EnvironmentInjector, Injector } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DIALOG_REF } from '../modules/libs/summarize-dialog/summarize-dialog.component';

export interface DialogRef<T = any> {
  afterClosed(): Observable<T>;
  close(result?: T): void;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialogContainerElement: HTMLElement | null = null;
  private openDialogs: {componentRef: ComponentRef<any>, overlayElement: HTMLElement}[] = [];

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private environmentInjector: EnvironmentInjector
  ) {}

  open<T, D = any>(component: Type<T>, config: {
    width?: string,
    data?: D
  } = {}): DialogRef<any> {
    // Create container for the dialog if it doesn't exist
    if (!this.dialogContainerElement) {
      this.dialogContainerElement = document.createElement('div');
      this.dialogContainerElement.className = 'dialog-container';
      document.body.appendChild(this.dialogContainerElement);
    }

    // Create an overlay element that will contain the dialog
    const overlayElement = document.createElement('div');
    overlayElement.className = 'dialog-overlay';
    this.dialogContainerElement.appendChild(overlayElement);

    // Create a wrapper for the dialog
    const dialogWrapper = document.createElement('div');
    dialogWrapper.className = 'dialog-wrapper';
    if (config.width) {
      dialogWrapper.style.width = config.width;
      dialogWrapper.style.maxWidth = '90vw';
    } else {
      dialogWrapper.style.width = '400px';
    }
    overlayElement.appendChild(dialogWrapper);

    // Create the dialog ref
    const closeSubject = new Subject<any>();
    const dialogRef: DialogRef = {
      afterClosed: () => closeSubject.asObservable(),
      close: (result?: any) => {
        closeSubject.next(result);
        closeSubject.complete();
        
        // Remove dialog from DOM
        this.removeDialog(componentRef, overlayElement);
      }
    };

    // Create a custom injector with dialog data and ref
    const dialogInjector = Injector.create({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: config.data },
        { provide: DIALOG_REF, useValue: dialogRef }
      ],
      parent: this.injector
    });

    // Create the component
    const componentRef = createComponent(component, {
      environmentInjector: this.environmentInjector,
      hostElement: dialogWrapper,
      elementInjector: dialogInjector
    });

    // Attach component to the application
    this.appRef.attachView(componentRef.hostView);

    // Add to open dialogs
    this.openDialogs.push({ componentRef, overlayElement });

    // Handle clicking on the overlay (outside the dialog) to close it
    overlayElement.addEventListener('click', (event: MouseEvent) => {
      if (event.target === overlayElement) {
        dialogRef.close();
      }
    });

    // Add keydown event listener to handle Escape key
    const escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dialogRef.close();
        document.removeEventListener('keydown', escapeListener);
      }
    };
    document.addEventListener('keydown', escapeListener);

    return dialogRef;
  }

  private removeDialog(componentRef: ComponentRef<any>, overlayElement: HTMLElement): void {
    // Remove component from application
    this.appRef.detachView(componentRef.hostView);
    componentRef.destroy();

    // Remove overlay from DOM
    if (overlayElement.parentNode) {
      overlayElement.parentNode.removeChild(overlayElement);
    }

    // Remove from open dialogs
    this.openDialogs = this.openDialogs.filter(
      dialog => dialog.componentRef !== componentRef
    );

    // If no more dialogs, remove container
    if (this.openDialogs.length === 0 && this.dialogContainerElement) {
      document.body.removeChild(this.dialogContainerElement);
      this.dialogContainerElement = null;
    }
  }
}