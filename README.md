# ContexAI Group - Production Website

Production-ready website for ContexAI Group, a premier boutique financial consulting firm specializing in dispute resolution, startup advisory, and strategic initiatives across multiple sectors.

## Features

### Leadership
- **Board of Directors**: Experienced professionals from leading financial institutions, regulatory bodies, and international development organizations
- **Leadership Team**: Deep expertise with practical experience across multiple sectors and markets
- **Founder & CEO**: Amir Waheed Ahmed with 20+ years of experience in financial consulting and PPP advisory

### Services
- Interactive tabbed navigation for services (Financial, Dispute Resolution, Advisory, Sector Expertise)
- Mobile-responsive menu with smooth animations
- Comprehensive insights section with industry research
- Client testimonials for social proof
- Statistics section showcasing expertise and track record

### Sectors of Expertise
- Water Technologies
- Petrochemicals
- Oil & Gas
- Power Sector
- EPC Contracting
- Digital Banking and Fintech
- Micro Finance
- Smart & Organic Farming
- Sustainability and SDGs
- Public Private Partnerships (PPP)
- Start-up Incubation & Support

### Design & User Experience
- Enhanced visual design with improved gradients, hover effects, and animations
- Scroll-based navigation effects and interactive elements
- Professional presentation focused on consulting services
- Mobile-first responsive design approach
- Accessibility features with focus-visible states

## Deployment

The site is deployed to **contexai.org** via Netlify. Configuration lives in `netlify.toml`.

```powershell
# One-time setup
netlify link              # link this folder to the Netlify project
netlify status            # confirm the link

# Each release
netlify deploy --prod     # uploads contents of public/
```

## Folder Layout

```
public/                 ← deployed to contexai.org
  index.html            ← live homepage

_archive/               ← legacy/draft versions, NOT deployed
  ContexAi_Website.html             (original version)
  ContexAi_NewWebsite.html          (legacy enhanced version)
  ContexAi_ProductionWebsite.html   (early stub)
  ContexAi_ProductionWebsite_staging.html

<root>/                 ← venture brand pages, NOT currently deployed
  Apni_Sawari_Website.html
  Events_Brand_Studio_Website.html
  FarmDirect_Market_Website.html
  Food_HomeChef_Website.html
  PopoPanda_Website.html
  Zameen-o-Makan_Website.html

netlify.toml            ← Netlify build config (publish = "public")
README.md               ← this file
```

To publish a venture page, move it (or copy it) into `public/` and redeploy.