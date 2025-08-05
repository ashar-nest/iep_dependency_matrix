import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HeaderComponent } from '../../shared/header/header.component';
import { DataService } from '../../../services/data.service';
import { AuthService } from '../../../services/auth.service';
import { MatrixItem } from '../../../models/matrix-item';
import { Router } from '@angular/router';
import { saveAs } from 'file-saver';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatrixDialogComponent } from '../../libs/matrix-dialog/matrix-dialog.component';
import { ConfirmDialogComponent } from '../../libs/confirm-dialog/confirm-dialog.component';
import { DialogService } from '../../../services/dialog.service';
import { SummarizeDialogComponent } from '../../libs/summarize-dialog/summarize-dialog.component';
import { ModuleDetailsDialogComponent } from '../../libs/module-details/module-details-dialog.component';

interface Column {
  key: string;
  title: string;
  sortable: boolean;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(10px)' }))
      ])
    ])
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HeaderComponent
  ]
})
export class DashboardComponent implements OnInit, AfterViewInit {
  // Expose Math object to the template
  Math = Math;
  
  // Base columns that everyone can see
  baseColumns: Column[] = [
    { key: 'module', title: 'Module', sortable: true },
    { key: 'subModule', title: 'Sub Module', sortable: true },
    { key: 'functionality', title: 'Functionality', sortable: true },
    { key: 'dependencyModule', title: 'Dependency Module', sortable: true },
    { key: 'dependantFunctionality', title: 'Dependant Functionality', sortable: true },
    { key: 'api', title: 'API', sortable: true }
  ];

  // Admin-only column
  adminColumn: Column = { key: 'actions', title: 'Actions', sortable: false };
  
  // Displayed columns will be set based on user role
  displayedColumns: Column[] = [];
  
  // Data handling
  items: MatrixItem[] = [];
  filteredItems: MatrixItem[] = [];
  isAdmin = false;
  stats: any = null;
  searchTerm: string = '';
  statsCollapsed: boolean = false;
  selectedModuleFilter: string = '';
  selectedSubModuleFilter: string = '';
  
  // Module to SubModule mapping
  moduleToSubModules: {[key: string]: string[]} = {};
  
  // Sorting
  currentSortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filter options for each column
  moduleFilterOptions: string[] = [];
  subModuleFilterOptions: string[] = [];
  filteredSubModuleOptions: string[] = [];
  functionalityFilterOptions: string[] = [];
  subTaskFilterOptions: string[] = [];
  dependencyFilterOptions: string[] = [];
  apiFilterOptions: string[] = [];
  
  // Filtered options for search in dropdowns
  filteredModuleOptions: string[] = [];
  filteredFunctionalityOptions: string[] = [];
  filteredSubTaskOptions: string[] = [];
  filteredDependencyOptions: string[] = [];
  filteredApiOptions: string[] = [];
  
  // Selected filter values for each column
  selectedModules: string[] = [];
  selectedSubModules: string[] = [];
  selectedFunctionalities: string[] = [];
  selectedSubTasks: string[] = [];
  selectedDependencies: string[] = [];
  selectedApis: string[] = [];
  
  // Temporary filter selections (before applying)
  tempSelectedModules: string[] = [];
  tempSelectedSubModules: string[] = [];
  tempSelectedFunctionalities: string[] = [];
  tempSelectedSubTasks: string[] = [];
  tempSelectedDependencies: string[] = [];
  tempSelectedApis: string[] = [];
  
  // Filter dropdown states
  activeFilterDropdown: string | null = null;
  
  // Message handling
  message: string | null = null;
  
  // ViewChildren for filter dropdowns
  @ViewChild('searchInput') searchInput!: ElementRef;
  
  // Original data (before filtering)
  private originalData: MatrixItem[] = [];

  // Custom dropdown states
  isModuleDropdownOpen = false;
  isSubModuleDropdownOpen = false;
  
  // Reference to the dropdown containers
  @ViewChild('moduleDropdown') moduleDropdownRef!: ElementRef;
  @ViewChild('subModuleDropdownContainer') subModuleDropdownRef!: ElementRef;
  
  // Position data for the dropdown overlays
  moduleDropdownPosition = { top: '0px', left: '0px' };
  subModuleDropdownPosition = { top: '0px', left: '0px' };
  
  constructor(
    private dataService: DataService,
    private authService: AuthService,
    private router: Router,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    // Check if user is logged in
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    // Check user role
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.isAdmin = user.role === 'admin';
        
        // Set displayed columns based on user role
        this.displayedColumns = this.isAdmin ? [...this.baseColumns, this.adminColumn] : [...this.baseColumns];
      }
    });

    // Fetch module to submodule mapping FIRST
    console.log('Initializing dashboard - loading module mapping first');
    this.loadModuleMapping();

    // Then fetch matrix data and statistics
    this.loadMatrixData();
    this.loadStatistics();
  }
  
  ngAfterViewInit() {
    // No material-specific afterViewInit needed
  }

  // Close filter dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // If clicking on a filter button, let the toggleFilterDropdown handle it
    if (target.closest('.filter-button')) {
      return;
    }
    
    // If clicking outside a dropdown while one is open, close it
    if (this.activeFilterDropdown && !target.closest('.filter-dropdown')) {
      this.activeFilterDropdown = null;
    }
    
    // Close the module dropdown if clicking outside
    if (this.isModuleDropdownOpen && 
        !target.closest('.dropdown-header') && 
        !target.closest('.dropdown-menu')) {
      this.isModuleDropdownOpen = false;
    }
    
    // Close the submodule dropdown if clicking outside
    if (this.isSubModuleDropdownOpen && 
        !target.closest('.dropdown-header') && 
        !target.closest('.dropdown-menu')) {
      this.isSubModuleDropdownOpen = false;
    }
  }

  loadModuleMapping(): void {
    this.dataService.getModuleMapping().subscribe({
      next: (mapping) => {
        //console.log('Module mapping loaded successfully with modules:', Object.keys(mapping));
        this.moduleToSubModules = mapping;
        
        // Set the module filter options directly from the mapping keys
        this.moduleFilterOptions = Object.keys(mapping).sort();
        this.filteredModuleOptions = [...this.moduleFilterOptions];
        
        // Initialize filtered submodule options
        this.updateFilteredSubModules();
        
        console.log('Module mapping loaded successfully:', this.moduleFilterOptions.length, 'modules found');
      },
      error: (error) => {
        console.error('Error fetching module mapping:', error);
        this.showMessage('Error loading module data. Some filtering features may not work correctly.');
      }
    });
  }

  loadMatrixData(): void {
    this.dataService.getMatrixItems().subscribe({
      next: (data) => {
        console.log('Matrix data loaded:', data.length, 'items');
        // Store the original data and use it directly (already normalized by the server)
        this.originalData = [...data];
        this.items = [...data];
        this.filteredItems = [...data];
        
        // Log first few items to verify module and submodule data
        if (data.length > 0) {
          /*console.log('First few matrix items:', data.slice(0, 3).map(item => ({
            id: item.id,
            module: item.module,
            subModule: item.subModule
          })));*/
        }
        
        // Extract unique values for columns EXCEPT module and subModule which come from moduleToSubModules
        this.extractFilterOptionsExceptModules();
      },
      error: (error) => {
        console.error('Error fetching matrix data:', error);
      }
    });
  }
  
  // Extract unique values for filter dropdowns (except module and subModule)
  extractFilterOptionsExceptModules(): void {
    const functionalities = new Set<string>();
    const dependencyModules = new Set<string>();
    const dependantFunctionalities = new Set<string>();
    const apis = new Set<string>();
    
    this.originalData.forEach(item => {
      if (item.functionality) functionalities.add(item.functionality);
      if (item.dependencyModule) dependencyModules.add(item.dependencyModule);
      if (item.dependantFunctionality) dependantFunctionalities.add(item.dependantFunctionality);
      if (item.api) apis.add(item.api);
    });
    
    // Don't overwrite module and subModule options as they come from moduleToSubModules
    this.functionalityFilterOptions = Array.from(functionalities).sort();
    this.subTaskFilterOptions = Array.from(dependencyModules).sort();
    this.dependencyFilterOptions = Array.from(dependantFunctionalities).sort();
    this.apiFilterOptions = Array.from(apis).sort();
    
    // Initialize filtered options with all available options
    this.filteredFunctionalityOptions = [...this.functionalityFilterOptions];
    this.filteredSubTaskOptions = [...this.subTaskFilterOptions];
    this.filteredDependencyOptions = [...this.dependencyFilterOptions];
    this.filteredApiOptions = [...this.apiFilterOptions];
  }
  
  // Get all available submodules from the module mapping
  getAllSubModules(): string[] {
    if (!this.moduleToSubModules) return [];
    
    // Collect all submodules from all modules
    const allSubModules = new Set<string>();
    Object.values(this.moduleToSubModules).forEach(subModules => {
      subModules.forEach(subModule => allSubModules.add(subModule));
    });
    
    return Array.from(allSubModules).sort();
  }
  
  // Toggle filter dropdown visibility
  toggleFilterDropdown(column: string, event: Event): void {
    event.stopPropagation();
    
    if (this.activeFilterDropdown === column) {
      this.activeFilterDropdown = null;
    } else {
      this.activeFilterDropdown = column;
      
      // Initialize temporary selections with current selections when opening dropdown
      this.initializeTempSelections(column);
      
      // Reset the filtered options for this column to show all available options initially
      this.resetFilteredOptionsForColumn(column);
      
      // Wait for DOM update to calculate position
     /* setTimeout(() => {
        // Get the filter dropdown element
        const filterDropdown = document.querySelector('.filter-dropdown') as HTMLElement;
        if (!filterDropdown) return;
        
        // Get the button that was clicked
        const filterButton = event.currentTarget as HTMLElement;
        const buttonRect = filterButton.getBoundingClientRect();
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        
        // Get the dropdown width
        const dropdownWidth = filterDropdown.offsetWidth;
        
        // Calculate position
        let leftPosition = -112; // Default left offset
        
        // Check if the dropdown would overflow the right side of the viewport
        if (buttonRect.right + (dropdownWidth - buttonRect.width) > viewportWidth) {
          // Position to the left of the button if it would overflow right
          leftPosition = -dropdownWidth + 24; // 24px accounts for the button width
        } else if (buttonRect.left < dropdownWidth / 2) {
          // If near the left edge, align with the left side of the button
          leftPosition = 0;
        }
        
        // Apply the position
        filterDropdown.style.left = `${leftPosition}px`;
      }, 0);*/
    }
  }
  
  // Initialize temporary selections when dropdown opens
  initializeTempSelections(column: string): void {
    switch (column) {
      case 'module':
        this.tempSelectedModules = [...this.selectedModules];
        break;
      case 'subModule':
        this.tempSelectedSubModules = [...this.selectedSubModules];
        break;
      case 'functionality':
        this.tempSelectedFunctionalities = [...this.selectedFunctionalities];
        break;
      case 'dependencyModule':
        this.tempSelectedSubTasks = [...this.selectedSubTasks];
        break;
      case 'dependantFunctionality':
        this.tempSelectedDependencies = [...this.selectedDependencies];
        break;
      case 'api':
        this.tempSelectedApis = [...this.selectedApis];
        break;
    }
  }

  // Reset filtered options for a specific column to show all available options
  resetFilteredOptionsForColumn(column: string): void {
    switch (column) {
      case 'module':
        this.filteredModuleOptions = [...this.moduleFilterOptions];
        break;
      case 'subModule':
        this.filteredSubModuleOptions = [...this.subModuleFilterOptions];
        break;
      case 'functionality':
        this.filteredFunctionalityOptions = [...this.functionalityFilterOptions];
        break;
      case 'dependencyModule':
        this.filteredSubTaskOptions = [...this.subTaskFilterOptions];
        break;
      case 'dependantFunctionality':
        this.filteredDependencyOptions = [...this.dependencyFilterOptions];
        break;
      case 'api':
        this.filteredApiOptions = [...this.apiFilterOptions];
        break;
    }
  }

  // Toggle module filter dropdown
  toggleModuleDropdown(event: Event): void {

    event.stopPropagation();
    this.isModuleDropdownOpen = !this.isModuleDropdownOpen;
    
    // If we're opening the module dropdown, close the submodule dropdown
    if (this.isModuleDropdownOpen) {
      this.isSubModuleDropdownOpen = false;
      
      /*setTimeout(() => {
        // Get the position of the clicked dropdown button
        const dropdownElement = (event.currentTarget as HTMLElement);
        const rect = dropdownElement.getBoundingClientRect();
        
        // Position the dropdown below the button
        this.moduleDropdownPosition = {
          top: `${rect.bottom + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`
        };
      });*/
    }
  }
  
  // Toggle submodule filter dropdown
  toggleSubModuleDropdown(event: Event): void {
    event.stopPropagation();
    this.isSubModuleDropdownOpen = !this.isSubModuleDropdownOpen;
    
    // If we're opening the submodule dropdown, close the module dropdown
    if (this.isSubModuleDropdownOpen) {
      this.isModuleDropdownOpen = false;
      
      /*setTimeout(() => {
        // Get the position of the clicked dropdown button
        const dropdownElement = (event.currentTarget as HTMLElement);
        const rect = dropdownElement.getBoundingClientRect();
        
        // Position the dropdown below the button
        this.subModuleDropdownPosition = {
          top: `${rect.bottom + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`
        };
      });*/
    }
  }
  
  // Select a module from the dropdown
  selectModule(module: string, event: Event): void {
    event.stopPropagation();
  
    this.selectedModuleFilter = module;
    this.isModuleDropdownOpen = false;
    
    // Clear the submodule filter when changing module
    this.selectedSubModuleFilter = '';
    this.selectedSubModules = [];
    
    // Update the filtered submodules
    this.updateFilteredSubModules();
    
    // Apply filter
    this.filterBySelectedModule();
  }
  
  // Select a submodule from the dropdown
  selectSubModule(subModule: string, event: Event): void {
    event.stopPropagation();
    this.selectedSubModuleFilter = subModule;
    this.isSubModuleDropdownOpen = false;
    this.filterBySelectedSubModule();
  }
  
  // Update filtered submodules based on selected module
  updateFilteredSubModules(): void {
    if (!this.selectedModuleFilter) {
      // If no module is selected, show all submodules from all modules
      this.subModuleFilterOptions = this.getAllSubModules();
      this.filteredSubModuleOptions = [...this.subModuleFilterOptions];
      console.log(`No module selected, showing all ${this.filteredSubModuleOptions.length} submodules`);
    } else if (this.moduleToSubModules && this.moduleToSubModules[this.selectedModuleFilter]) {
      // Filter submodules based on selected module using the module mapping
      const subModules = this.moduleToSubModules[this.selectedModuleFilter] || [];
      this.subModuleFilterOptions = [...subModules];
      this.filteredSubModuleOptions = [...subModules];
      
      // If we have a submodule filter selected that is no longer valid for this module, clear it
      if (this.selectedSubModuleFilter && !subModules.includes(this.selectedSubModuleFilter)) {
        this.selectedSubModuleFilter = '';
      }
      
      console.log(`Module "${this.selectedModuleFilter}" selected, showing ${this.filteredSubModuleOptions.length} submodules`);
    } else {
      console.warn(`Selected module "${this.selectedModuleFilter}" not found in module mapping`);
      this.filteredSubModuleOptions = [];
      this.subModuleFilterOptions = [];
    }
  }
  
  // Sort functionality
  sortData(column: string): void {
    if (!column || column === 'actions') return;
    
    if (this.currentSortColumn === column) {
      // Toggle direction if clicking the same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      this.currentSortColumn = column;
      this.sortDirection = 'asc';
    }
    
    this.filteredItems.sort((a, b) => {
      const valueA = (a[column as keyof MatrixItem] || '').toString().toLowerCase();
      const valueB = (b[column as keyof MatrixItem] || '').toString().toLowerCase();
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  // Apply combined filters from all columns
  applyFilters(): void {
    this.filteredItems = this.originalData.filter(item => {
      // Check if the item passes all active filters
      const passesModuleFilter = this.selectedModules.length === 0 || 
                                (item.module && this.selectedModules.includes(item.module));
      
      const passesSubModuleFilter = this.selectedSubModules.length === 0 || 
                                   (item.subModule && this.selectedSubModules.includes(item.subModule));
      
      const passesFunctionalityFilter = this.selectedFunctionalities.length === 0 || 
                                       (item.functionality && this.selectedFunctionalities.includes(item.functionality));
      
      const passesSubTaskFilter = this.selectedSubTasks.length === 0 || 
                                 (item.dependencyModule && this.selectedSubTasks.includes(item.dependencyModule));
      
      const passesDependencyFilter = this.selectedDependencies.length === 0 || 
                                    (item.dependantFunctionality && this.selectedDependencies.includes(item.dependantFunctionality));
      
      const passesApiFilter = this.selectedApis.length === 0 || 
                             (item.api && this.selectedApis.includes(item.api));
      
      // Apply text search filter as well
      const passesSearch = !this.searchTerm || 
                          (item.module && item.module.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                          (item.subModule && item.subModule.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                          (item.functionality && item.functionality.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                          (item.dependencyModule && item.dependencyModule.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                          (item.dependantFunctionality && item.dependantFunctionality.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                          (item.api && item.api.toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      return passesModuleFilter && passesSubModuleFilter && passesFunctionalityFilter && passesSubTaskFilter && passesDependencyFilter && passesApiFilter && passesSearch;
    });
    
    // If sorting was applied, maintain it
    if (this.currentSortColumn) {
      this.sortData(this.currentSortColumn);
    }
  }
  
  // Clear all filters
  clearAllFilters(): void {
    // Clear table column filters
    this.selectedModules = [];
    this.selectedSubModules = [];
    this.selectedFunctionalities = [];
    this.selectedSubTasks = [];
    this.selectedDependencies = [];
    this.selectedApis = [];
    
    // Also clear temporary selections
    this.tempSelectedModules = [];
    this.tempSelectedSubModules = [];
    this.tempSelectedFunctionalities = [];
    this.tempSelectedSubTasks = [];
    this.tempSelectedDependencies = [];
    this.tempSelectedApis = [];
    
    this.searchTerm = '';

    // DO NOT clear these - keep module/submodule dropdown selections intact:
    // this.selectedModuleFilter = '';
    // this.selectedSubModuleFilter = '';
    
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
    
    this.filteredItems = [...this.originalData];
    
    // Apply existing module/submodule filters if they are set
    this.applyFilters();
  }
  
  // Clear filters for a specific column
  clearColumnFilter(column: string): void {
    switch (column) {
      case 'module':
        this.selectedModules = [];
        this.tempSelectedModules = []; // Also clear temp selections
        this.selectedModuleFilter = '';
        break;
      case 'subModule':
        this.selectedSubModules = [];
        this.tempSelectedSubModules = []; // Also clear temp selections
        this.selectedSubModuleFilter = '';
        // Update filtered submodules when clearing submodule filter
        this.updateFilteredSubModules();
        break;
      case 'functionality':
        this.selectedFunctionalities = [];
        this.tempSelectedFunctionalities = []; // Also clear temp selections
        break;
      case 'dependencyModule':
        this.selectedSubTasks = [];
        this.tempSelectedSubTasks = []; // Also clear temp selections
        break;
      case 'dependantFunctionality':
        this.selectedDependencies = [];
        this.tempSelectedDependencies = []; // Also clear temp selections
        break;
      case 'api':
        this.selectedApis = [];
        this.tempSelectedApis = []; // Also clear temp selections
        break;
    }
    this.applyFilters();
  }
  
  // Clear filters for a specific column (temporary selections)
  clearColumnFilterTemp(column: string): void {
    switch (column) {
      case 'module':
        this.tempSelectedModules = [];
        break;
      case 'subModule':
        this.tempSelectedSubModules = [];
        break;
      case 'functionality':
        this.tempSelectedFunctionalities = [];
        break;
      case 'dependencyModule':
        this.tempSelectedSubTasks = [];
        break;
      case 'dependantFunctionality':
        this.tempSelectedDependencies = [];
        break;
      case 'api':
        this.tempSelectedApis = [];
        break;
    }
    
    // Force change detection and UI update
    setTimeout(() => {
      // Trigger change detection to update checkboxes
    }, 0);
  }
  
  // Add a method to cancel filter changes (revert temp selections)
  cancelFilterChanges(): void {
    // Revert temporary selections to current actual selections
    this.tempSelectedModules = [...this.selectedModules];
    this.tempSelectedSubModules = [...this.selectedSubModules];
    this.tempSelectedFunctionalities = [...this.selectedFunctionalities];
    this.tempSelectedSubTasks = [...this.selectedSubTasks];
    this.tempSelectedDependencies = [...this.selectedDependencies];
    this.tempSelectedApis = [...this.selectedApis];
    
    // Close the dropdown
    this.activeFilterDropdown = null;
  }
  
  loadStatistics(): void {
    this.dataService.getMatrixStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Error fetching statistics:', error);
      }
    });
  }

  openMatrixDialog(item?: MatrixItem): void {
    if (!this.isAdmin) {
      this.showMessage('Only admin users can add or edit items');
      return;
    }
    
    const dialogRef = this.dialogService.open(MatrixDialogComponent, {
      width: '600px',
      data: { item: item, moduleMapping: this.moduleToSubModules } // Pass mapping for sub module selection
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.id) {
          // Update existing item
          this.dataService.updateMatrixItem(result).subscribe({
            next: () => {
              // Reload module mapping first to ensure we have the latest module data
              this.loadModuleMapping();
              
              // Then refresh the matrix data
              setTimeout(() => {
                this.loadMatrixData();
                this.showMessage('Item updated successfully');
                this.loadStatistics(); // Refresh stats
              }, 300);
            },
            error: (error) => {
              console.error('Error updating matrix item:', error);
              this.showMessage('Error updating item');
            }
          });
        } else {
          // Add new item
          this.dataService.addMatrixItem(result).subscribe({
            next: () => {
              // Reload module mapping first to ensure we have the latest module data
              this.loadModuleMapping();
              
              // Then refresh the matrix data
              setTimeout(() => {
                this.loadMatrixData();
                this.showMessage('Item added successfully');
                this.loadStatistics(); // Refresh stats
              }, 300);
            },
            error: (error) => {
              console.error('Error adding matrix item:', error);
              this.showMessage('Error adding item');
            }
          });
        }
      }
    });
  }

  editItem(item: MatrixItem): void {
    console.log(item);
    if (!this.isAdmin) {
      this.showMessage('Only admin users can edit items');
      return;
    }
    this.openMatrixDialog(item);
  }
  
  deleteItem(item: MatrixItem): void {
    if (!this.isAdmin) {
      this.showMessage('Only admin users can delete items');
      return;
    }
    
    // Check if item has an ID
    if (!item.id && item.id !== 0) {
      this.showMessage('Cannot delete item: Missing ID');
      return;
    }
    
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      //width: '400px',
      data: {
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete "${item.module}: ${item.subModule}"?`,
        confirmButton: 'Delete'
      }
    });
    
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.dataService.deleteMatrixItem(item.id!).subscribe({
          next: () => {
            // Remove item from data
            this.originalData = this.originalData.filter(i => i.id !== item.id);
            // Reapply filters
            this.applyFilters();
            this.showMessage('Item deleted successfully');
            this.loadStatistics(); // Refresh stats
          },
          error: (error) => {
            console.error('Error deleting matrix item:', error);
            this.showMessage('Error deleting item');
          }
        });
      }
    });
  }
  
  exportToExcel(): void {
    // Export only the currently filtered/displayed data
    if (this.filteredItems.length === 0) {
      this.showMessage('No data to export');
      return;
    }
    
    // Two options for export: use backend for currently filtered data or generate Excel on client
    if (this.filteredItems.length === this.originalData.length) {
      // If no filtering is applied, use the existing backend export
      this.dataService.exportToExcel().subscribe({
        next: (blob) => {
          saveAs(blob, 'dependency-matrix.xlsx');
          this.showMessage('Export successful');
        },
        error: (error) => {
          console.error('Error exporting data:', error);
          this.showMessage('Error exporting data');
        }
      });
    } else {
      // If filtering is applied, export only filtered data
      this.dataService.exportFilteredDataToExcel(this.filteredItems).subscribe({
        next: (blob) => {
          saveAs(blob, 'iep-dependency-matrix.xlsx');
          this.showMessage('Export of filtered data successful');
        },
        error: (error) => {
          console.error('Error exporting filtered data:', error);
          this.showMessage('Error exporting filtered data');
        }
      });
    }
  }
  
  showMessage(message: string): void {
    this.message = message;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.message = null;
    }, 3000);
  }
  
  getObjectKeys(obj: any): string[] {
    // Ensure we always have an object by defaulting to empty object
    // This prevents "Object.keys of undefined" errors during initialization
    return Object.keys(obj || {});
  }

  // Filter options based on search input - now properly filters within the current column's base options
  filterOptions(column: string, event: Event): void {
    const searchText = (event.target as HTMLInputElement).value.toLowerCase().trim();
    
    // Get the base options for the column (not the already filtered ones)
    let baseOptions: string[] = [];
    
    switch (column) {
      case 'module':
        baseOptions = this.moduleFilterOptions;
        this.filteredModuleOptions = baseOptions.filter(
          option => option.toLowerCase().includes(searchText)
        );
        break;
      case 'subModule':
        baseOptions = this.subModuleFilterOptions;
        this.filteredSubModuleOptions = baseOptions.filter(
          option => option.toLowerCase().includes(searchText)
        );
        break;
      case 'functionality':
        baseOptions = this.functionalityFilterOptions;
        this.filteredFunctionalityOptions = baseOptions.filter(
          option => option.toLowerCase().includes(searchText)
        );
        break;
      case 'dependencyModule':
        baseOptions = this.subTaskFilterOptions;
        this.filteredSubTaskOptions = baseOptions.filter(
          option => option.toLowerCase().includes(searchText)
        );
        break;
      case 'dependantFunctionality':
        baseOptions = this.dependencyFilterOptions;
        this.filteredDependencyOptions = baseOptions.filter(
          option => option.toLowerCase().includes(searchText)
        );
        break;
      case 'api':
        baseOptions = this.apiFilterOptions;
        this.filteredApiOptions = baseOptions.filter(
          option => option.toLowerCase().includes(searchText)
        );
        break;
    }
  }
  
  // Toggle a single filter option
  toggleFilterOption(column: string, option: string, isChecked: boolean): void {
    switch (column) {
      case 'module':
        if (isChecked) {
          this.selectedModules.push(option);
        } else {
          this.selectedModules = this.selectedModules.filter(item => item !== option);
        }
        break;
      case 'subModule':
        if (isChecked) {
          this.selectedSubModules.push(option);
        } else {
          this.selectedSubModules = this.selectedSubModules.filter(item => item !== option);
        }
        break;
      case 'functionality':
        if (isChecked) {
          this.selectedFunctionalities.push(option);
        } else {
          this.selectedFunctionalities = this.selectedFunctionalities.filter(item => item !== option);
        }
        break;
      case 'dependencyModule':
        if (isChecked) {
          this.selectedSubTasks.push(option);
        } else {
          this.selectedSubTasks = this.selectedSubTasks.filter(item => item !== option);
        }
        break;
      case 'dependantFunctionality':
        if (isChecked) {
          this.selectedDependencies.push(option);
        } else {
          this.selectedDependencies = this.selectedDependencies.filter(item => item !== option);
        }
        break;
      case 'api':
        if (isChecked) {
          this.selectedApis.push(option);
        } else {
          this.selectedApis = this.selectedApis.filter(item => item !== option);
        }
        break;
    }
  }
  
  isOptionSelected(column: string, option: string): boolean {
    switch (column) {
      case 'module':
        return this.selectedModules.includes(option);
      case 'subModule':
        return this.selectedSubModules.includes(option);
      case 'functionality':
        return this.selectedFunctionalities.includes(option);
      case 'dependencyModule':
        return this.selectedSubTasks.includes(option);
      case 'dependantFunctionality':
        return this.selectedDependencies.includes(option);
      case 'api':
        return this.selectedApis.includes(option);
      default:
        return false;
    }
  }
  
  // Get appropriate filter options array based on column
  getFilterOptions(column: string): string[] {
    switch (column) {
      case 'module':
        return this.filteredModuleOptions;
      case 'subModule':
        return this.filteredSubModuleOptions;
      case 'functionality':
        return this.filteredFunctionalityOptions;
      case 'dependencyModule':
        return this.filteredSubTaskOptions;
      case 'dependantFunctionality':
        return this.filteredDependencyOptions;
      case 'api':
        return this.filteredApiOptions;
      default:
        return [];
    }
  }

  // Handle filter option checkbox changes
  handleFilterOptionChange(column: string, option: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.toggleFilterOption(column, option, isChecked);
    this.applyFilters();
  }
  
  // Close the message toast
  closeMessage(): void {
    this.message = null;
  }

  // Toggle statistics panel expand/collapse
  toggleStats(): void {
    this.statsCollapsed = !this.statsCollapsed;
  }

  // Filter the table based on the selected module in the dropdown
  filterBySelectedModule(): void {
    // If no module is selected (empty string), show all data
    if (!this.selectedModuleFilter) {
      this.selectedModules = [];
      this.applyFilters();
      return;
    }
    
    // Otherwise filter by the selected module
    this.selectedModules = [this.selectedModuleFilter];
    this.applyFilters();
  }
  
  // Filter the table based on the selected submodule in the dropdown
  filterBySelectedSubModule(): void {
    // If no submodule is selected (empty string), show all data for the selected module
    if (!this.selectedSubModuleFilter) {
      this.selectedSubModules = [];
      this.applyFilters();
      return;
    }
    
    // Otherwise filter by the selected submodule
    this.selectedSubModules = [this.selectedSubModuleFilter];
    this.applyFilters();
  }

  openSummarizeDialog(event: Event): void {
    event.stopPropagation();
    
    // Filter parameters based on selected module/submodule
    let module = this.selectedModuleFilter || '';
    let subModule = this.selectedSubModuleFilter || '';
    
    let title = 'IEP Dependency Matrix Summary';
   /* if (module && subModule) {
      title = `${module} - ${subModule} Dependencies`;
    } else if (module) {
      title = `${module} Module Dependencies`;
    }*/
    
    // Show loading message
    this.showMessage('Opening summary view...');
    
    console.log('Opening summarize dialog with title:', title);
    
    try {
      // Open the dialog
      const dialogRef = this.dialogService.open(SummarizeDialogComponent, {
        width: '90%',
        data: {
          title: title
        }
      });
      
      // Handle dialog closing
      dialogRef.afterClosed().subscribe(result => {
        console.log('Dialog closed', result);
      });
      
      // Hide the message after dialog is opened
      setTimeout(() => this.message = null, 500);
    } catch (error) {
      console.error('Error opening summarize dialog:', error);
      this.showMessage('Error opening summary view');
    }
  }

  openModuleDetailsDialog(event: Event): void {
    event.stopPropagation();
    
    // Show loading message
    this.showMessage('Opening module details view...');
    
    console.log('Opening module details dialog');
    
    try {
      // Open the dialog
      const dialogRef = this.dialogService.open(ModuleDetailsDialogComponent, {
        width: '95%',
        data: {
          title: 'Module Details'
        }
      });
      
      // Handle dialog closing
      dialogRef.afterClosed().subscribe(result => {
        console.log('Module details dialog closed', result);
      });
      
      // Hide the message after dialog is opened
      setTimeout(() => this.message = null, 500);
    } catch (error) {
      console.error('Error opening module details dialog:', error);
      this.showMessage('Error opening module details view');
    }
  }

  // Apply text search filter
  applySearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.applyFilters();
  }
  
  // Toggle all checkboxes in a column
  toggleAll(column: string, isChecked: boolean): void {
    switch (column) {
      case 'module':
        this.selectedModules = isChecked ? [...this.moduleFilterOptions] : [];
        break;
      case 'subModule':
        this.selectedSubModules = isChecked ? [...this.subModuleFilterOptions] : [];
        break;
      case 'functionality':
        this.selectedFunctionalities = isChecked ? [...this.functionalityFilterOptions] : [];
        break;
      case 'dependencyModule':
        this.selectedSubTasks = isChecked ? [...this.subTaskFilterOptions] : [];
        break;
      case 'dependantFunctionality':
        this.selectedDependencies = isChecked ? [...this.dependencyFilterOptions] : [];
        break;
      case 'api':
        this.selectedApis = isChecked ? [...this.apiFilterOptions] : [];
        break;
    }
    this.applyFilters();
  }
  
  // Toggle all checkboxes in a column (for temporary selections)
  toggleAllTemp(column: string, isChecked: boolean): void {
    switch (column) {
      case 'module':
        this.tempSelectedModules = isChecked ? [...this.moduleFilterOptions] : [];
        break;
      case 'subModule':
        this.tempSelectedSubModules = isChecked ? [...this.subModuleFilterOptions] : [];
        break;
      case 'functionality':
        this.tempSelectedFunctionalities = isChecked ? [...this.functionalityFilterOptions] : [];
        break;
      case 'dependencyModule':
        this.tempSelectedSubTasks = isChecked ? [...this.subTaskFilterOptions] : [];
        break;
      case 'dependantFunctionality':
        this.tempSelectedDependencies = isChecked ? [...this.dependencyFilterOptions] : [];
        break;
      case 'api':
        this.tempSelectedApis = isChecked ? [...this.apiFilterOptions] : [];
        break;
    }
  }
  
  // Handle checkbox toggle for "select all" option
  handleCheckboxToggleAll(column: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.toggleAll(column, isChecked);
  }
  
  // Handle checkbox toggle for "select all" option (for temporary selections)
  handleCheckboxToggleAllTemp(column: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.toggleAllTemp(column, isChecked);
  }
  
  // Toggle a single filter option (for temporary selections)
  toggleFilterOptionTemp(column: string, option: string, isChecked: boolean): void {
    switch (column) {
      case 'module':
        if (isChecked) {
          if (!this.tempSelectedModules.includes(option)) {
            this.tempSelectedModules.push(option);
          }
        } else {
          this.tempSelectedModules = this.tempSelectedModules.filter(item => item !== option);
        }
        break;
      case 'subModule':
        if (isChecked) {
          if (!this.tempSelectedSubModules.includes(option)) {
            this.tempSelectedSubModules.push(option);
          }
        } else {
          this.tempSelectedSubModules = this.tempSelectedSubModules.filter(item => item !== option);
        }
        break;
      case 'functionality':
        if (isChecked) {
          if (!this.tempSelectedFunctionalities.includes(option)) {
            this.tempSelectedFunctionalities.push(option);
          }
        } else {
          this.tempSelectedFunctionalities = this.tempSelectedFunctionalities.filter(item => item !== option);
        }
        break;
      case 'dependencyModule':
        if (isChecked) {
          if (!this.tempSelectedSubTasks.includes(option)) {
            this.tempSelectedSubTasks.push(option);
          }
        } else {
          this.tempSelectedSubTasks = this.tempSelectedSubTasks.filter(item => item !== option);
        }
        break;
      case 'dependantFunctionality':
        if (isChecked) {
          if (!this.tempSelectedDependencies.includes(option)) {
            this.tempSelectedDependencies.push(option);
          }
        } else {
          this.tempSelectedDependencies = this.tempSelectedDependencies.filter(item => item !== option);
        }
        break;
      case 'api':
        if (isChecked) {
          if (!this.tempSelectedApis.includes(option)) {
            this.tempSelectedApis.push(option);
          }
        } else {
          this.tempSelectedApis = this.tempSelectedApis.filter(item => item !== option);
        }
        break;
    }
  }
  
  // Check if a temporary option is selected
  isTempOptionSelected(column: string, option: string): boolean {
    switch (column) {
      case 'module':
        return this.tempSelectedModules.includes(option);
      case 'subModule':
        return this.tempSelectedSubModules.includes(option);
      case 'functionality':
        return this.tempSelectedFunctionalities.includes(option);
      case 'dependencyModule':
        return this.tempSelectedSubTasks.includes(option);
      case 'dependantFunctionality':
        return this.tempSelectedDependencies.includes(option);
      case 'api':
        return this.tempSelectedApis.includes(option);
      default:
        return false;
    }
  }
  
  // Handle filter option checkbox changes (for temporary selections)
  handleFilterOptionChangeTemp(column: string, option: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.toggleFilterOptionTemp(column, option, isChecked);
  }
  
  // Apply filters from temporary selections to actual selections
  applyColumnFilters(): void {
    // Copy temporary selections to actual selections
    this.selectedModules = [...this.tempSelectedModules];
    this.selectedSubModules = [...this.tempSelectedSubModules];
    this.selectedFunctionalities = [...this.tempSelectedFunctionalities];
    this.selectedSubTasks = [...this.tempSelectedSubTasks];
    this.selectedDependencies = [...this.tempSelectedDependencies];
    this.selectedApis = [...this.tempSelectedApis];
    
    // Apply the filters
    this.applyFilters();
    
    // Close the dropdown
    this.activeFilterDropdown = null;
  }
  
  // Check if a column has active filters
  hasActiveFilters(column: string): boolean {
    switch (column) {
      case 'module':
        return this.selectedModules.length > 0;
      case 'subModule':
        return this.selectedSubModules.length > 0;
      case 'functionality':
        return this.selectedFunctionalities.length > 0;
      case 'dependencyModule':
        return this.selectedSubTasks.length > 0;
      case 'dependantFunctionality':
        return this.selectedDependencies.length > 0;
      case 'api':
        return this.selectedApis.length > 0;
      default:
        return false;
    }
  }

  // Helper to check if all options in a column are selected (for temporary selections)
  areAllSelected(column: string): boolean {
    const filterOptions = this.getFilterOptions(column);
    if (filterOptions.length === 0) {
      return false; // If no filter data, "Select All" should be unchecked
    }
    
    switch (column) {
      case 'module':
        return filterOptions.length > 0 && filterOptions.length === this.tempSelectedModules.length && 
               filterOptions.every(option => this.tempSelectedModules.includes(option));
      case 'subModule':
        return filterOptions.length > 0 && filterOptions.length === this.tempSelectedSubModules.length && 
               filterOptions.every(option => this.tempSelectedSubModules.includes(option));
      case 'functionality':
        return filterOptions.length > 0 && filterOptions.length === this.tempSelectedFunctionalities.length && 
               filterOptions.every(option => this.tempSelectedFunctionalities.includes(option));
      case 'dependencyModule':
        return filterOptions.length > 0 && filterOptions.length === this.tempSelectedSubTasks.length && 
               filterOptions.every(option => this.tempSelectedSubTasks.includes(option));
      case 'dependantFunctionality':
        return filterOptions.length > 0 && filterOptions.length === this.tempSelectedDependencies.length && 
               filterOptions.every(option => this.tempSelectedDependencies.includes(option));
      case 'api':
        return filterOptions.length > 0 && filterOptions.length === this.tempSelectedApis.length && 
               filterOptions.every(option => this.tempSelectedApis.includes(option));
      default:
        return false;
    }
  }

  // Helper to check if there are any temporary selections for a column
  hasTempSelections(column: string): boolean {
    switch (column) {
      case 'module':
        return this.tempSelectedModules.length > 0;
      case 'subModule':
        return this.tempSelectedSubModules.length > 0;
      case 'functionality':
        return this.tempSelectedFunctionalities.length > 0;
      case 'dependencyModule':
        return this.tempSelectedSubTasks.length > 0;
      case 'dependantFunctionality':
        return this.tempSelectedDependencies.length > 0;
      case 'api':
        return this.tempSelectedApis.length > 0;
      default:
        return false;
    }
  }
}
