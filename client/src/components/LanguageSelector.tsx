import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation, Language } from '@/lib/translations';

const languageFlags = {
  en: '🇺🇸',
  sn: '🇿🇼',
  nd: '🇿🇼'
};

const languageNames = {
  en: 'English',
  sn: 'ChiShona', 
  nd: 'IsiNdebele'
};

export function LanguageSelector() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{languageFlags[language]} {languageNames[language]}</span>
          <span className="sm:hidden">{languageFlags[language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-sm font-semibold text-gray-700">
          {t('language')}
        </div>
        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={`gap-2 ${language === 'en' ? 'bg-blue-50 text-blue-700' : ''}`}
        >
          🇺🇸 {t('english')}
          {language === 'en' && <span className="ml-auto text-blue-600">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('sn')}
          className={`gap-2 ${language === 'sn' ? 'bg-blue-50 text-blue-700' : ''}`}
        >
          🇿🇼 {t('shona')}
          {language === 'sn' && <span className="ml-auto text-blue-600">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('nd')}
          className={`gap-2 ${language === 'nd' ? 'bg-blue-50 text-blue-700' : ''}`}
        >
          🇿🇼 {t('ndebele')}
          {language === 'nd' && <span className="ml-auto text-blue-600">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}