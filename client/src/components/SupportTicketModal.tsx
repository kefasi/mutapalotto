import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/translations";
import { apiRequest } from "@/lib/queryClient";
import { useSession } from "@/hooks/useSession";
import { AlertCircle, CheckCircle, Send } from "lucide-react";

const supportTicketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  category: z.string().min(1, "Please select a category"),
  priority: z.string().min(1, "Please select a priority"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  contactEmail: z.string().email("Please enter a valid email address").optional(),
  contactPhone: z.string().optional(),
});

type SupportTicketFormData = z.infer<typeof supportTicketSchema>;

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const categories = {
  en: {
    general: 'General Questions',
    payments: 'Payments & EcoCash',
    tickets: 'Lottery Tickets',
    agent: 'Agent Network',
    technical: 'Technical Support',
    account: 'Account Issues'
  },
  sn: {
    general: 'Mibvunzo Yakajairwa',
    payments: 'Kubhadhara & EcoCash',
    tickets: 'Matikiti eLottery',
    agent: 'Vatengesi',
    technical: 'Rubatsiro rweTekinoroji',
    account: 'Matambudziko eAccount'
  },
  nd: {
    general: 'Imibuzo Ejwayelekileyo',
    payments: 'Ukukhokhela & EcoCash',
    tickets: 'Amatikithi e-Lottery',
    agent: 'Ummeli Wethu',
    technical: 'Usizo Lwezobuchwepheshe',
    account: 'Izinkinga Ze-akhawunti'
  }
};

const priorities = {
  en: {
    low: 'Low - General inquiry',
    medium: 'Medium - Account issue',
    high: 'High - Payment problem',
    urgent: 'Urgent - Cannot access account'
  },
  sn: {
    low: 'Shoma - Mubvunzo wakajairwa',
    medium: 'Pakati - Dambudziko re-account',
    high: 'Hukuru - Dambudziko rekubhadhara',
    urgent: 'Kukurumidzwa - Handikwanise kupinda mu-account'
  },
  nd: {
    low: 'Okuphansi - Umbuzo ojwayelekileyo',
    medium: 'Okuphakathi - Inkinga ye-akhawunti',
    high: 'Okuphezulu - Inkinga yokukhokha',
    urgent: 'Okuphuthumayo - Anginakho ukufinyelela i-akhawunti'
  }
};

export default function SupportTicketModal({ isOpen, onClose }: SupportTicketModalProps) {
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<SupportTicketFormData>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      subject: "",
      category: "",
      priority: "",
      description: "",
      contactEmail: user?.phone ? `${user.phone}@example.com` : "",
      contactPhone: user?.phone || "",
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: SupportTicketFormData) => {
      return apiRequest("/api/support/tickets", "POST", {
        ...data,
        userId: user?.id,
        userPhone: user?.phone,
        userName: user?.name || "Anonymous User",
        status: 'open',
        language: language
      });
    },
    onSuccess: () => {
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      toast({
        title: language === 'en' ? "Ticket Submitted" : 
               language === 'sn' ? "Chikumbiro Chatumirwa" : "I-thikithi Lithunyelwe",
        description: language === 'en' ? "We'll respond within 24 hours" :
                    language === 'sn' ? "Tichapindura mukati mehours 24" :
                    "Sizophendula ngaphakathi kwamahora angama-24",
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'en' ? "Error" : 
               language === 'sn' ? "Kukanganisa" : "Iphutha",
        description: error.message || (
          language === 'en' ? "Failed to submit ticket" :
          language === 'sn' ? "Kutadza kutumira chikumbiro" :
          "Kuhlulekile ukuthuma ithikithi"
        ),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SupportTicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const handleClose = () => {
    if (isSubmitted) {
      setIsSubmitted(false);
      form.reset();
    }
    onClose();
  };

  if (isSubmitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              {language === 'en' ? 'Ticket Submitted Successfully!' :
               language === 'sn' ? 'Chikumbiro Chatumirwa Zvakanaka!' :
               'I-thikithi Lithunyelwe Ngempumelelo!'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="mb-4">
              <Badge variant="outline" className="text-sm">
                {language === 'en' ? 'Ticket ID: ' :
                 language === 'sn' ? 'ID yeChikumbiro: ' :
                 'I-ID yethikithi: '}
                #{Math.random().toString(36).substr(2, 8).toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-6">
              {language === 'en' ? 
                'Your support request has been submitted. Our team will review your ticket and respond within 24 hours via SMS or phone call.' :
               language === 'sn' ? 
                'Chikumbiro chenyu chekubatsirwa chatumirwa. Timu yedu ichatarisisa chikumbiro chenyu uye ichapindura mukati mehours 24 kuburikidza neSMS kana nhare.' :
                'Isicelo sakho sosizo sithunyelwe. Ithimba lethu lizobuyekeza ithikithi lakho futhi liphendule ngaphakathi kwamahora angama-24 nge-SMS noma ikholi.'}
            </p>
            <Button onClick={handleClose} className="w-full">
              {language === 'en' ? 'Close' :
               language === 'sn' ? 'Vhara' :
               'Vala'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            {language === 'en' ? 'Submit Support Ticket' :
             language === 'sn' ? 'Tumira Chikumbiro Chekubatsirwa' :
             'Thumela I-thikithi Losizo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {language === 'en' ? 'Subject' :
                     language === 'sn' ? 'Musoro' :
                     'Isihloko'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        language === 'en' ? 'Brief description of your issue...' :
                        language === 'sn' ? 'Tsananguro pfupi yedambudziko rako...' :
                        'Incazelo emfushane yenkinga yakho...'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {language === 'en' ? 'Category' :
                     language === 'sn' ? 'Chikamu' :
                     'Isigaba'}
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          language === 'en' ? 'Select a category...' :
                          language === 'sn' ? 'Sarudza chikamu...' :
                          'Khetha isigaba...'
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(categories[language]).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {language === 'en' ? 'Priority' :
                     language === 'sn' ? 'Kukurumidzwa' :
                     'Ubuhle bakho'}
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          language === 'en' ? 'Select priority level...' :
                          language === 'sn' ? 'Sarudza level yekukurumidzwa...' :
                          'Khetha izinga lokubaluleka...'
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(priorities[language]).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === 'en' ? 'Contact Email (Optional)' :
                       language === 'sn' ? 'Email (Kusina Kumanikidzwa)' :
                       'I-imeyili Yokuthintana (Okukhethayo)'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={
                          language === 'en' ? 'your.email@example.com' :
                          language === 'sn' ? 'email.yako@example.com' :
                          'i-imeyili.yakho@example.com'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === 'en' ? 'Phone Number' :
                       language === 'sn' ? 'Nhamba Yefoni' :
                       'Inombolo Yefoni'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+263..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {language === 'en' ? 'Detailed Description' :
                     language === 'sn' ? 'Tsananguro Yakakwana' :
                     'Incazelo Enemininingwane'}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[120px]"
                      placeholder={
                        language === 'en' ? 'Please provide as much detail as possible about your issue. Include any error messages, steps you took, and what you expected to happen...' :
                        language === 'sn' ? 'Ndapota ipa ruzivo rwakawanda se unokwanisa pamusoro pedambudziko rako. Batanidza chero meseji dzekukanganisa, matanho awakaita, uye zvawaitarisira kuitika...' :
                        'Sicela unikeze imininingwane eminingi ngangokunokwenzeka mayelana nenkinga yakho. Faka nayiphi imiyalezo yamaphutha, izinyathelo ozithathile, nalokho obulindele ukuthi kwenzeke...'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Important Notice */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">
                    {language === 'en' ? 'Response Time' :
                     language === 'sn' ? 'Nguva Yekupindura' :
                     'Isikhathi Sokuphendula'}
                  </p>
                  <p>
                    {language === 'en' ? 
                      'Our support team will respond within 24 hours via SMS to your registered phone number. For urgent issues, you can also call our support line.' :
                     language === 'sn' ? 
                      'Timu yedu yekubatsira ichapindura mukati mehours 24 kuburikidza neSMS kunhamba yako yakanyoreswa. Kune zvakakurumidzwa, unogona fonerawo line yedu yekubatsira.' :
                      'Ithimba lethu losizo lizophendula ngaphakathi kwamahora angama-24 nge-SMS kunombolo yakho yefoni ebhalisiwe. Kwezinto eziphuthumayo, ungashayela futhi umugqa wethu wosizo.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                {language === 'en' ? 'Cancel' :
                 language === 'sn' ? 'Kanzura' :
                 'Khansela'}
              </Button>
              <Button
                type="submit"
                disabled={createTicketMutation.isPending}
                className="flex-1"
              >
                {createTicketMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {language === 'en' ? 'Submit Ticket' :
                 language === 'sn' ? 'Tumira Chikumbiro' :
                 'Thumela I-thikithi'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}