import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Reference {
  id: string;
  targetType: string;
  targetName: string;
  content: string;
  numericScore: number;
  referenceType: string;
  status: string;
  createdAt: string;
}

export default function ReferencesPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const { data: referencesResponse, refetch } = useQuery<{
    references: Reference[];
  }>({
    queryKey: ["/api/references/my"],
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
  });

  const references = referencesResponse?.references || [];

  const handleViewReference = (reference: Reference) => {
    setSelectedReference(reference);
    setViewModalOpen(true);
  };

  const handleRevokeReference = async (referenceId: string) => {
    try {
      const response = await fetch(`/api/references/${referenceId}/revoke`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (response.ok) {
        refetch();
        setViewModalOpen(false);
      } else {
        console.error('Failed to revoke reference');
      }
    } catch (error) {
      console.error('Error revoking reference:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "signed":
        return <Badge className="bg-green-100 text-green-800">Signed</Badge>;
      case "revoked":
        return <Badge className="bg-red-100 text-red-800">Revoked</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 2) return 'text-red-500 font-black';
    if (score <= 3) return 'text-orange-500 font-black';
    if (score <= 4) return 'text-yellow-600 font-black';
    return 'text-green-500 font-black';
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case "user":
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        );
      case "group":
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
        );
      case "platform":
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
    }
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
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/"}
                className="border-fig/30 text-fig hover:bg-fig-10"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">My eReferences</h2>
            <p className="text-gray-700 mt-2 text-sm sm:text-base font-medium">Manage your professional references</p>
          </div>
        </div>

        {/* References Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-fig/5 to-white">
            <h3 className="text-xl sm:text-2xl font-black text-fig">Your References</h3>
            <p className="text-gray-700 text-sm mt-2 font-medium">References you've provided to others</p>
          </div>
          
          {references.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 bg-gradient-to-br from-fig/10 to-apple-red/10 rounded-2xl flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-700 mb-2">No references yet</p>
                  <p className="text-gray-500">Start by providing references to others</p>
                </div>
                <Button 
                  onClick={() => window.location.href = "/"}
                  className="px-4 py-2 bg-fig text-white rounded-lg font-medium hover:bg-fig/90 transition-colors"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-fig/10 to-fig/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/4">Target</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/3">Reference</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/6">Score</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/6">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/6">Status</th>
                      <th className="px-6 py-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {references.map((reference) => (
                      <tr key={reference.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-gradient-to-br from-fig/15 to-fig/10 border-fig/20 text-fig">
                              {getTargetIcon(reference.targetType)}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-fig">{reference.targetName}</div>
                              <div className="text-xs text-fig/70 capitalize">{reference.targetType}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 font-medium max-w-xs truncate">
                            {reference.content}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black ${getScoreColor(reference.numericScore)} bg-white border-2 w-12 h-7`}
                                style={{
                                  borderColor: getScoreColor(reference.numericScore).includes('red') ? '#ef4444' :
                                             getScoreColor(reference.numericScore).includes('orange') ? '#f97316' :
                                             getScoreColor(reference.numericScore).includes('yellow') ? '#eab308' : '#22c55e',
                                  backgroundColor: getScoreColor(reference.numericScore).includes('red') ? '#fef2f2' :
                                                 getScoreColor(reference.numericScore).includes('orange') ? '#fff7ed' :
                                                 getScoreColor(reference.numericScore).includes('yellow') ? '#fefce8' : '#f0fdf4'
                                }}>
                            {reference.numericScore}/5
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(reference.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(reference.status)}
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
                              <DropdownMenuItem onClick={() => handleViewReference(reference)}>
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                View Details
                              </DropdownMenuItem>
                              {reference.status === 'signed' && (
                                <DropdownMenuItem 
                                  onClick={() => handleRevokeReference(reference.id)}
                                  className="text-red-600"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                  Revoke Reference
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden space-y-4 px-4 py-4">
                {references.map((reference) => (
                  <div key={reference.id} className="bg-white rounded-xl p-4 shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center border bg-gradient-to-br from-fig/15 to-fig/10 border-fig/20 text-fig">
                          {getTargetIcon(reference.targetType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-fig mb-1">{reference.targetName}</div>
                          <div className="text-xs text-gray-600 font-medium mb-2">{reference.content}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewReference(reference)}>
                              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                              View Details
                            </DropdownMenuItem>
                            {reference.status === 'signed' && (
                              <DropdownMenuItem 
                                onClick={() => handleRevokeReference(reference.id)}
                                className="text-red-600"
                              >
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Revoke Reference
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-500">{new Date(reference.createdAt).toLocaleDateString()}</div>
                          <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-black ${getScoreColor(reference.numericScore)} bg-white border-2`}
                                style={{
                                  borderColor: getScoreColor(reference.numericScore).includes('red') ? '#ef4444' :
                                             getScoreColor(reference.numericScore).includes('orange') ? '#f97316' :
                                             getScoreColor(reference.numericScore).includes('yellow') ? '#eab308' : '#22c55e',
                                  backgroundColor: getScoreColor(reference.numericScore).includes('red') ? '#fef2f2' :
                                                 getScoreColor(reference.numericScore).includes('orange') ? '#fff7ed' :
                                                 getScoreColor(reference.numericScore).includes('yellow') ? '#fefce8' : '#f0fdf4'
                                }}>
                            {reference.numericScore}/5
                          </span>
                          {getStatusBadge(reference.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reference Details Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="sm:max-w-lg bg-gradient-to-br from-white to-gray-50 border-2 border-fig/20">
          <DialogHeader className="text-center pb-6">
            <DialogTitle className="flex items-center justify-center gap-3 text-fig text-xl font-black">
              <div className="w-8 h-8 bg-fig rounded-lg flex items-center justify-center transform rotate-12">
                <svg className="w-5 h-5 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              Reference Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedReference && (
            <div className="space-y-6">
              
              {/* Reference Content */}
              <div className="bg-gradient-to-br from-fig/5 to-apple-red/5 rounded-2xl p-6 border border-fig/10">
                <h3 className="font-black text-fig mb-4">Reference Text</h3>
                <p className="text-gray-700 leading-relaxed">{selectedReference.content}</p>
              </div>

              {/* Reference Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-apple-red/20 rounded-lg flex items-center justify-center">
                      {getTargetIcon(selectedReference.targetType)}
                    </div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Target</label>
                  </div>
                  <p className="text-sm font-black text-fig">{selectedReference.targetName}</p>
                  <p className="text-xs text-gray-500 capitalize">{selectedReference.targetType}</p>
                </div>
                
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-swiss-cheese/20 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-fig" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
                  </div>
                  <p className="text-sm font-black text-gray-900">
                    {new Date(selectedReference.createdAt).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-basil/20 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 text-basil" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Score</label>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-black ${getScoreColor(selectedReference.numericScore)}`}>
                    {selectedReference.numericScore}/5
                  </span>
                  {getStatusBadge(selectedReference.status)}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedReference.status === 'signed' && (
                  <Button 
                    onClick={() => handleRevokeReference(selectedReference.id)}
                    variant="outline" 
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Revoke Reference
                  </Button>
                )}
                <Button 
                  onClick={() => setViewModalOpen(false)}
                  className="flex-1 bg-fig hover:bg-fig/90 text-white font-bold"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
