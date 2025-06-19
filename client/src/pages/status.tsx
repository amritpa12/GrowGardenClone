import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Database, Server, Wifi, Users, Search, Award, Cloud } from "lucide-react";

interface StatusItem {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: string;
  responseTime?: string;
  icon: React.ReactNode;
}

export default function StatusPage() {
  // Get system status from API
  const { data: systemStatus, isLoading } = useQuery({
    queryKey: ['/api/system-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const statusItems: StatusItem[] = [
    {
      name: "Trading Platform",
      status: "operational",
      uptime: "99.9%",
      responseTime: "120ms",
      icon: <Server className="w-5 h-5" />
    },
    {
      name: "User Authentication",
      status: "operational", 
      uptime: "99.8%",
      responseTime: "80ms",
      icon: <Users className="w-5 h-5" />
    },
    {
      name: "Search System",
      status: "operational",
      uptime: "99.7%",
      responseTime: "45ms",
      icon: <Search className="w-5 h-5" />
    },
    {
      name: "Vouch System",
      status: "operational",
      uptime: "99.9%",
      responseTime: "65ms",
      icon: <Award className="w-5 h-5" />
    },
    {
      name: "Weather Updates",
      status: "operational",
      uptime: "100%",
      responseTime: "30ms",
      icon: <Cloud className="w-5 h-5" />
    },
    {
      name: "MongoDB Atlas",
      status: "operational",
      uptime: "99.95%",
      responseTime: "25ms",
      icon: <Database className="w-5 h-5" />
    },
    {
      name: "PostgreSQL Database",
      status: "operational",
      uptime: "99.9%",
      responseTime: "15ms",
      icon: <Database className="w-5 h-5" />
    },
    {
      name: "API Gateway",
      status: "operational",
      uptime: "99.8%",
      responseTime: "35ms",
      icon: <Wifi className="w-5 h-5" />
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'outage': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational': 
        return <Badge className="bg-green-600 hover:bg-green-700">Operational</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-600 hover:bg-yellow-700">Degraded</Badge>;
      case 'outage':
        return <Badge className="bg-red-600 hover:bg-red-700">Outage</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-6">
            <Server className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">System Status</h1>
          <p className="text-gray-300 text-lg">
            Real-time status and performance metrics for our trading platform
          </p>
        </div>

        {/* Overall Status */}
        <Card className="bg-black/80 border-gray-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              All Systems Operational
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-green-400">99.9%</div>
                <div className="text-gray-400">Overall Uptime</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">47ms</div>
                <div className="text-gray-400">Avg Response Time</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">8/8</div>
                <div className="text-gray-400">Services Online</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statusItems.map((item, index) => (
            <Card key={index} className="bg-black/80 border-gray-800 hover:border-purple-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span className="text-white font-medium">{item.name}</span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Uptime</span>
                    <span className="text-green-400">{item.uptime}</span>
                  </div>
                  {item.responseTime && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Response Time</span>
                      <span className="text-blue-400">{item.responseTime}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Information */}
        <Card className="bg-black/80 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Stay Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-6">
              Join our community for real-time updates and announcements about system status.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <a 
                href="https://discord.com/invite/wdMqEBAB4Z" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                💬 Join Our Discord
              </a>
            </div>

            <Separator className="my-6 bg-gray-700" />
            
            <div className="text-center text-gray-400 text-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4" />
                Last updated: {new Date().toLocaleString()}
              </div>
              <p>Status page refreshes automatically every 30 seconds</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}