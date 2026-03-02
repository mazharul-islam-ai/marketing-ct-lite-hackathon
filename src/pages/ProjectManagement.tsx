import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectImportDropdown } from '@/components/projects/ProjectImportDropdown';
import { ActiveCollabProjectCard } from '@/components/projects/ActiveCollabProjectCard';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
const ProjectManagement = () => {
  const {
    user
  } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch with high limit to get all projects, then filter for ActiveCollab
  const {
    projects,
    loading,
    refetch,
    deleteProject
  } = useProjects({
    limit: 1000 // Get all projects to properly filter
  });
  const canManageProjects = user && ['super_admin', 'manager', 'pm'].includes(user.role);
  const canDeleteProjects = user && ['super_admin', 'manager'].includes(user.role);

  // Filter to show projects imported from ActiveCollab or Control Tower
  const activeCollabProjects = projects.filter(p => (p as any).activecollab_id || p.activecollab_project_id || p.control_tower_project_id);

  // Calculate pagination for filtered results
  const totalProjects = activeCollabProjects.length;
  const totalPages = Math.ceil(totalProjects / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProjects = activeCollabProjects.slice(startIndex, endIndex);
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleDeleteClick = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      refetch();
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1.5">
            Manage and track all your projects from ActiveCollab and Control Tower
          </p>
        </div>

        {canManageProjects && <ProjectImportDropdown />}
      </div>

      {/* ActiveCollab Integration Info */}
      {canManageProjects}

      {/* Imported Projects List */}
      {canManageProjects && <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Imported Projects
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {totalProjects} project{totalProjects !== 1 ? 's' : ''} synced
              </p>
            </div>
          </div>

          {loading ? <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div> : totalProjects === 0 ? <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground mb-2 font-medium">
                  No projects imported yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Click "Import from ActiveCollab" or "Import from Control Tower" above to get started
                </p>
              </CardContent>
            </Card> : <>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedProjects.map(project => <ActiveCollabProjectCard 
                  key={project.id} 
                  project={project} 
                  onRefresh={refetch}
                  onDelete={canDeleteProjects ? handleDeleteClick : undefined}
                />)}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && <Card className="mt-6">
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Items per page selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Show</span>
                        <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="6">6</SelectItem>
                            <SelectItem value="12">12</SelectItem>
                            <SelectItem value="24">24</SelectItem>
                            <SelectItem value="48">48</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">per page</span>
                      </div>

                      {/* Page info and navigation */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages} ({totalProjects} total)
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          
                          {/* Page numbers */}
                          <div className="hidden sm:flex items-center gap-1 mx-2">
                            {Array.from({
                      length: Math.min(5, totalPages)
                    }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" className="w-9 h-9 p-0" onClick={() => handlePageChange(pageNum)}>
                                  {pageNum}
                                </Button>;
                    })}
                          </div>
                          
                          <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>}
            </>}
        </div>}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{projectToDelete?.name}" and all its tasks and comments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default ProjectManagement;