import { Component, Inject, OnInit, ViewChild, ElementRef, HostListener, Optional } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AsyncValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatrixItem } from '../../../models/matrix-item';
import { DataService } from '../../../services/data.service';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';
import {  } from '../../../services/dialog.service';
import { DialogRef } from '../../../services/dialog.service';
import { DIALOG_REF } from '../summarize-dialog/summarize-dialog.component';
@Component({
  selector: 'app-matrix-dialog',
  templateUrl: './matrix-dialog.component.html',
  styleUrls: ['./matrix-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ]
})
export class MatrixDialogComponent implements OnInit {
  matrixForm: FormGroup;
  isEditing: boolean = false;
  data: { item?: MatrixItem, moduleMapping?: {[key: string]: string[]} } = {};
  
  // Options for dropdowns
  moduleOptions: string[] = [];
  filteredSubModuleOptions: string[] = [];

  // Modern dropdown state
  isModuleDropdownOpen: boolean = false;
  isSubModuleDropdownOpen: boolean = false;
  
  // References to dropdown containers for click outside detection
  @ViewChild('moduleDropdownContainer') moduleDropdownContainer!: ElementRef;
  @ViewChild('subModuleDropdownContainer') subModuleDropdownContainer!: ElementRef;

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    @Optional() @Inject(DIALOG_REF) public dialogRef: DialogRef,
    @Optional() @Inject(MAT_DIALOG_DATA) public injectedData: any
  ) {
    this.matrixForm = this.fb.group({
      module: ['', Validators.required],
      subModule: ['', Validators.required],
      functionality: [''],
      dependencyModule: [''],
      dependantFunctionality: [''],
      api: ['']
    });
    // Always assign injectedData to this.data for compatibility
    this.data = this.injectedData || {};
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (this.moduleDropdownContainer && !this.moduleDropdownContainer.nativeElement.contains(event.target)) {
      this.isModuleDropdownOpen = false;
    }
    
    if (this.subModuleDropdownContainer && !this.subModuleDropdownContainer.nativeElement.contains(event.target)) {
      this.isSubModuleDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    // Always set isEditing based on presence of item
    this.isEditing = !!(this.data && this.data.item);
    // If moduleMapping is not provided, fetch from backend
    if (!this.data?.moduleMapping || Object.keys(this.data.moduleMapping).length === 0) {
      this.dataService.getModuleMapping().subscribe(mapping => {
        this.data.moduleMapping = mapping;
        this.initDropdownsAndForm();
      });
    } else {
      this.initDropdownsAndForm();
    }
  }

  private initDropdownsAndForm(): void {
    const mapping = this.data?.moduleMapping || {};
    this.moduleOptions = Object.keys(mapping).sort();
    if (this.isEditing && this.data.item) {
      const module = this.data.item.module;
      this.matrixForm.patchValue({ module: module || '' });
      this.filteredSubModuleOptions = mapping[module] ? [...mapping[module]] : [];
      this.matrixForm.patchValue({
        subModule: this.data.item.subModule || '',
        functionality: this.data.item.functionality || '',
        dependencyModule: this.data.item.dependencyModule || '',
        dependantFunctionality: this.data.item.dependantFunctionality || '',
        api: this.data.item.api || ''
      });
    } else {
      this.filteredSubModuleOptions = [];
      this.matrixForm.patchValue({
        module: '',
        subModule: '',
        functionality: '',
        dependencyModule: '',
        dependantFunctionality: '',
        api: ''
      });
    }
  }
  
  // Toggle module dropdown visibility
  toggleModuleDropdown(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.isModuleDropdownOpen = !this.isModuleDropdownOpen;
    if (this.isModuleDropdownOpen) {
      this.isSubModuleDropdownOpen = false; // Close other dropdown
    }
  }
  
  // Toggle sub-module dropdown visibility
  toggleSubModuleDropdown(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.isSubModuleDropdownOpen = !this.isSubModuleDropdownOpen;
    if (this.isSubModuleDropdownOpen) {
      this.isModuleDropdownOpen = false; // Close other dropdown
    }
  }
  
  // Select a module from the dropdown
  selectModule(module: string) {
    this.matrixForm.get('module')?.setValue(module);
    this.isModuleDropdownOpen = false;
    this.onModuleChange(); // Update sub-module options
  }
  
  // Select a sub-module from the dropdown
  selectSubModule(subModule: string) {
    this.matrixForm.get('subModule')?.setValue(subModule);
    this.isSubModuleDropdownOpen = false;
  }
  
  // Called when the module selection changes
  onModuleChange(): void {
    const selectedModule = this.matrixForm.get('module')?.value;
    console.log(`Module changed to ${selectedModule}, updating submodule options`);
    
    // Reset subModule when module changes
    this.matrixForm.get('subModule')?.setValue('');
    
    // Update submodule options based on selected module
    if (selectedModule && this.data.moduleMapping && this.data.moduleMapping[selectedModule]) {
      this.filteredSubModuleOptions = this.data.moduleMapping[selectedModule];
      console.log(`Updated submodules list with ${this.filteredSubModuleOptions.length} options`);
    } else {
      this.filteredSubModuleOptions = [];
      console.warn('No submodules found for selected module');
    }
  }

  // Custom async validator to check if API endpoint is unique
  apiUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const api = control.value;
      
      if (!api || api.trim() === '') {
        return of(null);
      }
      
      // Debounce to prevent too many API calls while typing
      return timer(300).pipe(
        switchMap(() => {
          const excludeId = this.isEditing && this.data?.item ? this.data.item.id : undefined;
          return this.dataService.checkApiExists(api, excludeId).pipe(
            catchError(() => {
              // If the API call fails, don't block the form submission
              console.error('API validation failed, allowing submission');
              return of(false);
            })
          );
        }),
        map(exists => {
          return exists ? { apiAlreadyExists: true } : null;
        })
      );
    };
  }

  onSubmit(): void {
    if (this.matrixForm.valid) {
      const formValue = this.matrixForm.value;
      let result: MatrixItem;

      // Ensure module and submodule values are normalized to match exact casing from the module mapping
      const normalizedModule = this.normalizeModuleName(formValue.module);
      const normalizedSubModule = this.normalizeSubModuleName(normalizedModule, formValue.subModule);
      
      // Log the normalization results for debugging
      console.log('Form submission - original values:', {
        module: formValue.module,
        subModule: formValue.subModule
      });
      
      console.log('Form submission - normalized values:', {
        module: normalizedModule,
        subModule: normalizedSubModule
      });
      
      // Apply normalized values
      formValue.module = normalizedModule;
      formValue.subModule = normalizedSubModule;

      if (this.isEditing && this.data?.item) {
        // Update existing item
        result = {
          ...this.data.item,
          ...formValue
        };
      } else {
        // Create new item
        result = formValue;
      }

      this.dialogRef.close(result);
    }
  }
  
  // Helper methods to normalize module and submodule names to match the mapping exactly
  private normalizeModuleName(module: string): string {
    if (!module || !this.data.moduleMapping) return module;
    
    // Find exact case-matching module name
    const exactMatch = Object.keys(this.data.moduleMapping).find(
      m => m.toLowerCase() === module.toLowerCase()
    );
    
    return exactMatch || module;
  }
  
  private normalizeSubModuleName(module: string, subModule: string): string {
    if (!module || !subModule || !this.data.moduleMapping || !this.data.moduleMapping[module]) {
      return subModule;
    }
    
    // Find exact case-matching submodule name
    const exactMatch = this.data.moduleMapping[module].find(
      sm => sm.toLowerCase() === subModule.toLowerCase()
    );
    
    return exactMatch || subModule;
  }
  
  // Add the missing onCancel method
  onCancel(): void {
    this.dialogRef.close();
  }
}
