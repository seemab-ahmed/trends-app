import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function LanguageSelectorButton() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-9 gap-1 bg-[#fff] text-black border border-gray-300 hover:bg-blue-700 hover:text-white"
        >
          <Globe className="h-4 w-4" />
          <span>{language === "en" ? "EN" : "IT"}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="bg-gray-300 text-black  border-0 shadow-lg"
      >
        <DropdownMenuItem
          className={cn(
            "!hover:bg-gray-200",
            language === "en" && "bg-gray-100"
          )}
          onClick={() => setLanguage("en")}
        >
          English
        </DropdownMenuItem>

        <DropdownMenuItem
          className={cn(
            "!hover:bg-gray-200",
            language === "it" && "bg-gray-100"
          )}
          onClick={() => setLanguage("it")}
        >
          Italiano
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
