import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Search, Plus, MessageCircle, TrendingUp, Users, MessageSquare, Star, Trophy } from "lucide-react";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { TradeAd } from "@shared/schema";

export default function TradeAds() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const { data: rawTradeAds = [] } = useQuery<TradeAd[]>({
    queryKey: ['/api/trade-ads'],
    enabled: true
  });

  // Filter and sort trade ads
  const filteredAndSortedTradeAds = rawTradeAds
    .filter(tradeAd => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      const title = tradeAd.title?.toLowerCase() || '';
      const description = tradeAd.description?.toLowerCase() || '';
      
      // Search in offering and wanting items
      const offeringItems = JSON.parse(tradeAd.offeringItems || '[]');
      const wantingItems = JSON.parse(tradeAd.wantingItems || '[]');
      
      const allItems = [...offeringItems, ...wantingItems];
      const itemMatches = allItems.some(item => 
        item.name?.toLowerCase().includes(searchLower) ||
        item.type?.toLowerCase().includes(searchLower) ||
        item.mutation?.toLowerCase().includes(searchLower)
      );
      
      return title.includes(searchLower) || 
             description.includes(searchLower) || 
             itemMatches;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'value-high':
          // Calculate total value of items (simplified)
          const aValue = JSON.parse(a.offeringItems || '[]').reduce((sum: number, item: any) => sum + (item.currentValue || 0), 0);
          const bValue = JSON.parse(b.offeringItems || '[]').reduce((sum: number, item: any) => sum + (item.currentValue || 0), 0);
          return bValue - aValue;
        case 'value-low':
          const aValueLow = JSON.parse(a.offeringItems || '[]').reduce((sum: number, item: any) => sum + (item.currentValue || 0), 0);
          const bValueLow = JSON.parse(b.offeringItems || '[]').reduce((sum: number, item: any) => sum + (item.currentValue || 0), 0);
          return aValueLow - bValueLow;
        case 'newest':
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });

  // Trading Activity Stats
  const tradingStats = {
    tradesLast24h: 11644,
    usersLast24h: 9882,
    conversationsLast24h: 138023,
    weeklyGrowth: 12.5,
    activeCommunity: true,
    activeDiscussions: 847
  };

  // Top Traders Data
  const topTraders = [
    { rank: 1, username: "jaminuyt3", trades: 46, badge: "TOP TRADER", color: "bg-yellow-500" },
    { rank: 2, username: "Bas1c_karma", trades: 42, badge: "TOP TRADER", color: "bg-gray-400" },
    { rank: 3, username: "SayaPro770", trades: 34, badge: "TOP TRADER", color: "bg-orange-600" },
    { rank: 4, username: "maddelist", trades: 29, badge: "TOP TRADER", color: "bg-yellow-600" },
    { rank: 5, username: "j0uju1", trades: 27, badge: "TOP TRADER", color: "bg-yellow-600" }
  ];

  // New Traders Data
  const newTraders = [
    { username: "Baddiwo", badge: "NEW", isNew: true },
    { username: "Romperka", badge: "NEW", isNew: true },
    { username: "Andressino130615", badge: "NEW", isNew: true },
    { username: "alexis233134", badge: "NEW", isNew: true },
    { username: "Ininama1904", badge: "NEW", isNew: true }
  ];

  const renderItemCard = (item: any, isOffering: boolean) => {
    // Clean the image URL - if it already has the proxy, use it directly
    const imageUrl = item.imageUrl?.startsWith('/api/image-proxy') 
      ? item.imageUrl 
      : item.imageUrl 
      ? `/api/image-proxy?url=${encodeURIComponent(item.imageUrl)}`
      : null;

    const gradientClass = isOffering 
      ? "from-purple-500 to-blue-500" 
      : "from-green-500 to-teal-500";

    return (
      <div key={item.id} className="bg-black/30 rounded-xl p-4 border border-gray-700/50">
        <div className="w-16 h-16 rounded-lg mx-auto mb-2 flex items-center justify-center relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-icon')) {
                  const fallbackDiv = document.createElement('div');
                  fallbackDiv.className = `fallback-icon w-full h-full bg-gradient-to-br ${gradientClass} rounded-lg flex items-center justify-center`;
                  fallbackDiv.innerHTML = `<span class="text-white text-xs font-bold">${item.name.slice(0, 2)}</span>`;
                  parent.appendChild(fallbackDiv);
                }
              }}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradientClass} rounded-lg flex items-center justify-center`}>
              <span className="text-white text-xs font-bold">{item.name.slice(0, 2)}</span>
            </div>
          )}
          
          {/* Quantity Badge */}
          {item.quantity && item.quantity > 1 ? (
            <div className="absolute -top-1 -right-1 bg-gray-900 text-white px-1.5 py-0.5 rounded text-xs font-bold border border-gray-600">
              ×{item.quantity}
            </div>
          ) : null}
        </div>
        
        {/* Customization Values */}
        {(item.weight > 0 || item.petAge > 0 || (item.mutation && item.mutation !== '')) ? (
          <div className="text-xs mb-2 space-y-0.5">
            {item.weight > 0 ? (
              <div className="text-center text-green-300 font-medium">
                {item.weight} kg
              </div>
            ) : null}
            {item.petAge > 0 ? (
              <div className="text-center text-blue-300 font-medium">
                Age: {item.petAge}
              </div>
            ) : null}
            {item.mutation && item.mutation !== '' ? (
              <div className="text-center text-purple-300 font-medium">
                {item.mutation}
                {item.mutationValue > 0 ? (
                  <span className="text-yellow-300 ml-1">({item.mutationValue.toLocaleString()})</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        
        <div className="text-center text-white text-sm font-medium">{item.name}</div>
        <div className="text-center text-gray-400 text-xs">{item.type}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <main className="pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <section className="py-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold mb-2 text-white">Trade Ads</h1>
                <p className="text-gray-400">Browse and find the perfect trade for your items.</p>
              </div>
              <Link href="/trade-ads/create">
                <Button className="gaming-button">
                  <Plus className="mr-2" size={18} />
                  Create Trade Ad
                </Button>
              </Link>
            </div>
          </section>

          {/* Trading Activity */}
          <section className="py-8">
            <Card className="gaming-card mb-8">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-purple-400 flex items-center">
                  <TrendingUp className="mr-2" size={20} />
                  Trading Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Trades Last 24hrs */}
                  <div className="bg-black/30 rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Trades</span>
                      <TrendingUp className="text-green-400" size={16} />
                    </div>
                    <div className="text-2xl font-bold text-white">{tradingStats.tradesLast24h.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Last 24 hours</div>
                  </div>

                  {/* Users Last 24hrs */}
                  <div className="bg-black/30 rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Active Users</span>
                      <Users className="text-blue-400" size={16} />
                    </div>
                    <div className="text-2xl font-bold text-white">{tradingStats.usersLast24h.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Last 24 hours</div>
                  </div>

                  {/* Conversations Last 24hrs */}
                  <div className="bg-black/30 rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Conversations</span>
                      <MessageSquare className="text-purple-400" size={16} />
                    </div>
                    <div className="text-2xl font-bold text-white">{tradingStats.conversationsLast24h.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Last 24 hours</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Traders and New Traders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Top Traders */}
              <Card className="gaming-card">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-purple-400 flex items-center">
                    <Trophy className="mr-2" size={18} />
                    Top Traders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topTraders.map((trader, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-gray-700/50">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 ${trader.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                            {trader.rank}
                          </div>
                          <div>
                            <div className="text-white font-medium">{trader.username}</div>
                            <div className="text-gray-400 text-xs">{trader.trades} trades</div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                          {trader.badge}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* New Traders */}
              <Card className="gaming-card">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-purple-400 flex items-center">
                    <Star className="mr-2" size={18} />
                    New Traders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {newTraders.map((trader, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-gray-700/50">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {trader.username.charAt(0)}
                          </div>
                          <div className="text-white font-medium">{trader.username}</div>
                        </div>
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                          {trader.badge}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Search and Filters */}
          <section className="py-8">
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  placeholder="Search items by name, mutation, or attributes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black/80 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500 h-12 rounded-lg"
                />
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-gray-400 text-sm whitespace-nowrap">Sort By</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48 bg-black/80 border-gray-600 text-white focus:border-purple-500 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="newest" className="text-white hover:bg-gray-800">Newest First</SelectItem>
                    <SelectItem value="oldest" className="text-white hover:bg-gray-800">Oldest First</SelectItem>
                    <SelectItem value="value-high" className="text-white hover:bg-gray-800">Highest Value</SelectItem>
                    <SelectItem value="value-low" className="text-white hover:bg-gray-800">Lowest Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Trade Listings */}
          <section className="py-8">
            <div className="space-y-6">
              {rawTradeAds.length === 0 ? (
                <Card className="gaming-card">
                  <CardContent className="p-12 text-center">
                    <div className="text-gray-400 mb-4">
                      <ArrowRightLeft className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold text-white mb-2">No Trade Ads Yet</h3>
                      <p>Be the first to create a trade ad and start trading!</p>
                    </div>
                    <Link href="/trade-ads/create">
                      <Button className="gaming-button">
                        <Plus className="mr-2" size={18} />
                        Create Your First Trade Ad
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : filteredAndSortedTradeAds.length === 0 ? (
                <Card className="gaming-card">
                  <CardContent className="p-12 text-center">
                    <div className="text-gray-400 mb-4">
                      <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold text-white mb-2">No Results Found</h3>
                      <p>Try adjusting your search terms or filters.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredAndSortedTradeAds.map((tradeAd) => {
                  const offeringItems = JSON.parse(tradeAd.offeringItems || '[]');
                  const wantingItems = JSON.parse(tradeAd.wantingItems || '[]');
                  
                  return (
                    <Card key={tradeAd.id} className="gaming-card">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500/50">
                              {(tradeAd as any).profileImageUrl ? (
                                <img 
                                  src={(tradeAd as any).profileImageUrl} 
                                  alt={(tradeAd as any).username || `User ${tradeAd.userId}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Fallback to generated avatar if Roblox image fails
                                    const target = e.target as HTMLImageElement;
                                    target.src = `https://ui-avatars.com/api/?name=${(tradeAd as any).username || 'User'}&background=8b5cf6&color=fff&size=40`;
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                  <span className="text-white font-bold text-sm">
                                    {((tradeAd as any).username || 'U').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-white">
                                {(tradeAd as any).username || `User ${tradeAd.userId}`}
                              </div>
                              <div className="text-sm text-gray-400">
                                {tradeAd.createdAt ? new Date(tradeAd.createdAt).toLocaleDateString() : 'Recent'}
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                              <MessageCircle className="mr-2" size={16} />
                              Chat
                            </Button>
                            <Button className="gaming-button">
                              <ArrowRightLeft className="mr-2" size={16} />
                              Trade
                            </Button>
                          </div>
                        </div>

                        <div className="mb-4">
                          <h3 className="text-white font-semibold">{tradeAd.title}</h3>
                          {tradeAd.description ? (
                            <p className="text-gray-400 text-sm mt-1">{tradeAd.description}</p>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                          {/* Offering */}
                          <div>
                            <div className="flex items-center space-x-2 mb-3">
                              <span className="text-purple-400 text-sm">🌟 Offering</span>
                            </div>
                            <div className="space-y-2">
                              {offeringItems.map((item: any, index: number) => 
                                <div key={`offering-${index}-${item.name}`}>
                                  {renderItemCard(item, true)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Trade Arrow */}
                          <div className="flex justify-center">
                            <div className="bg-purple-500/20 rounded-full p-3">
                              <ArrowRightLeft className="text-purple-400" size={24} />
                            </div>
                          </div>

                          {/* Wants */}
                          <div>
                            <div className="flex items-center space-x-2 mb-3">
                              <span className="text-purple-400 text-sm">🌟 Wants</span>
                            </div>
                            <div className="space-y-2">
                              {wantingItems.map((item: any, index: number) => 
                                <div key={`wanting-${index}-${item.name}`}>
                                  {renderItemCard(item, false)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}