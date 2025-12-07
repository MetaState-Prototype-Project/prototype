import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Store, ArrowRight } from "lucide-react";
import w3dsLogo from "@assets/w3dslogo.svg";
import appsData from "@/data/apps.json";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Apps");

  const apps = appsData;
  const isLoadingApps = false;

  const categories = ["All Apps", "Identity", "Social", "Governance", "Wellness", "Finance"];

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All Apps" || 
                           app.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <img 
                src={w3dsLogo} 
                alt="W3DS Logo" 
                className="h-8 w-auto"
              />
              <div className="text-sm font-medium text-gray-600">Marketplace</div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-black py-16" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-black mb-6">Discover the MetaState</h1>
          <p className="text-lg font-medium mb-10 max-w-3xl mx-auto">
            MetaState Post-Platforms for sovereign control of your data
          </p>
          <div className="flex justify-center">
            <div className="relative max-w-lg w-full">
              <Input 
                type="search" 
                placeholder="What are you looking for?" 
                className="w-full h-16 pl-6 pr-16 rounded-full border-0 text-black text-lg font-medium shadow-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-6 top-5 w-6 h-6 text-gray-400" />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200 ${
                  selectedCategory === category
                    ? "bg-black text-white"
                    : "bg-white text-black border-2 border-gray-200 hover:border-black"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* App Grid */}
      <main className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-4xl font-black text-black">Featured Apps</h2>
            <div className="flex items-center space-x-2 text-lg font-medium text-gray-600">
              <span>{filteredApps.length} apps found</span>
            </div>
          </div>

          {isLoadingApps ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-3xl p-8 border border-gray-100 animate-pulse">
                  <div className="flex items-start space-x-6">
                    <div className="w-20 h-20 bg-gray-200 rounded-2xl flex-shrink-0"></div>
                    <div className="flex-1 space-y-3">
                      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredApps.map((app) => (
                <Link key={app.id} href={`/app/${app.id}`}>
                  <div className="bg-white rounded-3xl p-8 border border-gray-100 hover:border-gray-300 transition-all duration-200 group cursor-pointer">
                    <div className="flex items-start space-x-6 mb-6">
                      {app.logoUrl ? (
                        <img 
                          src={app.logoUrl} 
                          alt={`${app.name} logo`} 
                          className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                          <Store className="w-10 h-10 text-black" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-black mb-2 group-hover:text-gray-700">
                          {app.name}
                        </h3>
                        <div className="flex items-center space-x-2 mb-3">
                          <Badge className="bg-gray-100 text-gray-700 font-semibold uppercase tracking-wide">
                            {app.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-6 line-clamp-2 font-medium">
                      {app.description}
                    </p>
                    <div className="flex items-center justify-end gap-3">
                      {(app as any).appStoreUrl && (app as any).playStoreUrl ? (
                        <>
                          <a 
                            href={(app as any).appStoreUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button className="w-full text-black font-bold px-4 py-3 rounded-full hover:opacity-90" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
                              App Store
                            </Button>
                          </a>
                          <a 
                            href={(app as any).playStoreUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button className="w-full text-black font-bold px-4 py-3 rounded-full hover:opacity-90" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                              Play Store
                            </Button>
                          </a>
                        </>
                      ) : (
                        <a 
                          href={(app as any).url || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button className="text-black font-bold px-6 py-3 rounded-full hover:opacity-90" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
                            Open App <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {filteredApps.length === 0 && !isLoadingApps && (
            <div className="text-center py-16">
              <Store className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-black mb-4">No apps found</h3>
              <p className="text-gray-600 font-medium">Try adjusting your search or category filter.</p>
            </div>
          )}
        </div>
      </main>


    </div>
  );
}
