import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ReferenceModal from "@/components/modals/reference-modal";
import ReferenceViewModal from "@/components/modals/reference-view-modal";

export default function References() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [viewModalOpen, setViewModalOpen] = useState<any>(null);
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [revokeModalOpen, setRevokeModalOpen] = useState<any>(null);
  const queryClient = useQueryClient();

  // This page is only rendered when authenticated, no need for redirect logic

  const { data: referencesData } = useQuery({
    queryKey: [`/api/references?page=${currentPage}&limit=10`],
    enabled: isAuthenticated,
  });

  const references = (referencesData as any)?.references || [];
  const pagination = (referencesData as any)?.pagination;

  // Revoke reference mutation
  const revokeMutation = useMutation({
    mutationFn: async (referenceId: string) => {
      return await apiRequest(`/api/references/${referenceId}/revoke`, 'PATCH');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/references?page=${currentPage}&limit=10`] });
      toast({
        title: "Reference Revoked",
        description: "The reference has been successfully revoked.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to revoke reference. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRevokeReference = (reference: any) => {
    setRevokeModalOpen(reference);
  };

  const confirmRevoke = () => {
    if (revokeModalOpen) {
      revokeMutation.mutate(revokeModalOpen.id);
      setRevokeModalOpen(null);
    }
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-fig border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
      {/* Navigation Header */}
      <nav className="bg-gradient-to-br from-white via-gray-50 to-white text-gray-900 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-3">
                <div className="w-10 h-10 bg-fig rounded-xl flex items-center justify-center shadow-lg transform rotate-12 border-2 border-swiss-cheese/30">
                  <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-black tracking-tight text-gray-900">eReputation</h1>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="hidden sm:block text-left">
                      <div className="font-semibold text-sm text-gray-900">
                        {user?.name || user?.handle || user?.ename || 'User'}
                      </div>
                      {user?.ename && user.name && (
                        <div className="text-xs text-gray-500">@{user.ename}</div>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => window.location.href = '/'}>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                    </svg>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* References Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">My References</h2>
            <p className="text-gray-700 mt-2 text-sm sm:text-base font-medium">Professional references you've given and received</p>
          </div>
          
          {/* Send eReference Button */}
          <button 
            onClick={() => setReferenceModalOpen(true)}
            className="group bg-secondary hover:bg-fig/30 border-2 border-secondary/40 hover:border-fig p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-3 self-start sm:self-auto"
          >
            <div className="w-12 h-12 bg-fig rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 transform rotate-12">
              <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-black text-lg text-fig leading-tight">Send an eReference</h3>
              <p className="text-fig/70 text-sm font-medium leading-tight">Provide a signed eReference</p>
            </div>
          </button>
        </div>

        {/* References Table - Desktop */}
        <div className="hidden sm:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-fig/5 to-apple-red/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/4">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/3">Subject</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider hidden sm:table-cell w-1/6">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider hidden lg:table-cell w-1/6">Status</th>
                  <th className="px-6 py-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {(references as any[]).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-center">
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No References Yet</h3>
                        <p className="text-gray-600 mb-4">You haven't given or received any professional references.</p>
                        <Button 
                          onClick={() => window.location.href = '/'}
                          className="bg-fig hover:bg-fig/90"
                        >
                          Go to Dashboard
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (references as any[]).map((reference: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                            reference.type === 'Sent' 
                              ? 'bg-gradient-to-br from-orange-500/15 to-orange-500/10 border-orange-500/20 text-orange-600' 
                              : 'bg-gradient-to-br from-green-500/15 to-green-500/10 border-green-500/20 text-green-600'
                          }`}>
                            {reference.type === 'Sent' ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h10.586l-2.293-2.293a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H4a1 1 0 01-1-1z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M17 10a1 1 0 01-1 1H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H16a1 1 0 011 1z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-fig">{reference.type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {reference.forFrom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                        {reference.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-white border-2 w-20 h-7 ${
                          reference.status === 'Signed' 
                            ? 'text-green-700' 
                            : 'text-red-700'
                        }`}
                              style={{
                                borderColor: reference.status === 'Signed' ? '#22c55e' : '#ef4444',
                                backgroundColor: reference.status === 'Signed' ? '#f0fdf4' : '#fef2f2'
                              }}>
                          {reference.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-gray-400 hover:text-gray-500 p-1 rounded">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewModalOpen(reference)}>
                              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                              View
                            </DropdownMenuItem>
                            {reference.status === 'Signed' && (
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleRevokeReference(reference)}
                              >
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                                Revoke
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* References Cards - Mobile */}
        <div className="sm:hidden space-y-4">
          {(references as any[]).length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No References Yet</h3>
              <p className="text-gray-600 mb-4">You haven't given or received any professional references.</p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-fig hover:bg-fig/90"
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            (references as any[]).map((reference: any, index: number) => (
              <div key={index} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      reference.type === 'Sent' 
                        ? 'bg-gradient-to-br from-orange-500/15 to-orange-500/10 border-orange-500/20 text-orange-600' 
                        : 'bg-gradient-to-br from-green-500/15 to-green-500/10 border-green-500/20 text-green-600'
                    }`}>
                      {reference.type === 'Sent' ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h10.586l-2.293-2.293a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17 10a1 1 0 01-1 1H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H16a1 1 0 011 1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-fig">{reference.type}</div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-gray-400 hover:text-gray-500 p-2 rounded">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewModalOpen(reference)}>
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        View
                      </DropdownMenuItem>
                      {reference.status === 'Signed' && (
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => handleRevokeReference(reference)}
                        >
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          </svg>
                          Revoke
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subject</div>
                    <div className="text-sm font-medium text-gray-900">{reference.forFrom}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</div>
                      <div className="text-sm text-gray-600">{reference.date}</div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-white border-2 w-20 h-7 ${
                        reference.status === 'Signed' 
                          ? 'text-green-700' 
                          : 'text-red-700'
                      }`}
                            style={{
                              borderColor: reference.status === 'Signed' ? '#22c55e' : '#ef4444',
                              backgroundColor: reference.status === 'Signed' ? '#f0fdf4' : '#fef2f2'
                            }}>
                        {reference.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
          
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-3 py-1 border border-fig/30 text-fig hover:bg-fig-10 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="px-3 py-1 border border-fig/30 text-fig hover:bg-fig-10 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* View Reference Modal */}
        <ReferenceViewModal 
          open={!!viewModalOpen} 
          onOpenChange={(open) => !open && setViewModalOpen(null)}
          reference={viewModalOpen}
        />

        {/* Send Reference Modal */}
        <ReferenceModal 
          open={referenceModalOpen} 
          onOpenChange={setReferenceModalOpen} 
        />

        {/* Revoke Confirmation Modal */}
        <Dialog open={!!revokeModalOpen} onOpenChange={(open) => !open && setRevokeModalOpen(null)}>
          <DialogContent className="w-full max-w-sm sm:max-w-md mx-4 sm:mx-auto bg-fig-10 border-2 border-fig/20 shadow-2xl rounded-xl">
            <DialogHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <DialogTitle className="text-xl font-black text-fig">Revoke Reference</DialogTitle>
              <DialogDescription className="text-fig/70 text-sm font-medium mt-2">
                Are you sure you want to revoke the reference for <strong>{revokeModalOpen?.forFrom}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setRevokeModalOpen(null)}
                className="flex-1 border-2 border-fig/30 text-fig/70 hover:bg-fig-10 hover:border-fig/40 font-bold h-11"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmRevoke}
                disabled={revokeMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11"
              >
                {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}