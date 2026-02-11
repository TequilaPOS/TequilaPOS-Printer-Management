// ===========================================
// Printer Driver Database
// Based on OpenPrinting.org driver listings
// ===========================================

/**
 * Driver database organized by manufacturer
 * Priority: specific model > manufacturer driver > generic driver > raw
 */
const DRIVER_DATABASE = {
    // =====================
    // HP Printers
    // =====================
    hp: {
        name: 'HP',
        aliases: ['hewlett', 'hewlett-packard', 'hp inc'],
        preferredDrivers: ['hplip', 'hpijs-pcl5e', 'hpijs-pcl5c', 'hpijs-pcl3'],
        fallbackDrivers: ['ljet4', 'ljet4d', 'pxlmono', 'pxlcolor'],
        genericDriver: 'drv:///hp/hpcups.drv/hp-laserjet_p2015-pcl3.ppd',
        models: {
            // LaserJet Series
            'laserjet p2055': { driver: 'hplip', search: ['P2055', 'hplip'] },
            'laserjet m402': { driver: 'hplip', search: ['M402', 'M403', 'hplip'] },
            'laserjet m404': { driver: 'hplip', search: ['M404', 'M405', 'hplip'] },
            'laserjet m426': { driver: 'hplip', search: ['M426', 'M427', 'hplip'] },
            'laserjet m203': { driver: 'hplip', search: ['M203', 'hplip'] },
            'laserjet m227': { driver: 'hplip', search: ['M227', 'M230', 'hplip'] },
            'laserjet pro': { driver: 'hplip', search: ['LaserJet Pro', 'hplip'] },
            'laserjet 4103': { driver: 'hplip', search: ['4103', 'hplip'] },
            'laser 408': { driver: 'hplip', search: ['408', 'hplip'] },
            'color laserjet': { driver: 'hplip', search: ['Color LaserJet', 'hplip'] },
            'designjet': { driver: 'hplip', search: ['DesignJet', 'hplip'] },
            // Generic HP
            'laserjet': { driver: 'hplip', search: ['LaserJet', 'hplip', 'ljet4'] },
            'deskjet': { driver: 'hplip', search: ['DeskJet', 'hplip', 'cdj'] },
            'officejet': { driver: 'hplip', search: ['OfficeJet', 'hplip'] },
        },
        // PCL language support
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // Kyocera Printers
    // =====================
    kyocera: {
        name: 'Kyocera',
        aliases: ['kyocera mita', 'kyocera document solutions'],
        preferredDrivers: ['Postscript-Kyocera', 'Kyocera'],
        fallbackDrivers: ['pxlmono', 'pxlcolor', 'ljet4'],
        genericDriver: 'everywhere', // Kyocera works great with driverless
        models: {
            'ecosys m2035': { driver: 'everywhere', search: ['M2035', 'Kyocera', 'ECOSYS'] },
            'ecosys m2040': { driver: 'everywhere', search: ['M2040', 'Kyocera', 'ECOSYS'] },
            'ecosys m2540': { driver: 'everywhere', search: ['M2540', 'Kyocera', 'ECOSYS'] },
            'ecosys m2640': { driver: 'everywhere', search: ['M2640', 'Kyocera', 'ECOSYS'] },
            'ecosys m3040': { driver: 'everywhere', search: ['M3040', 'Kyocera', 'ECOSYS'] },
            'ecosys m3540': { driver: 'everywhere', search: ['M3540', 'Kyocera', 'ECOSYS'] },
            'ecosys m3550': { driver: 'everywhere', search: ['M3550', 'Kyocera', 'ECOSYS'] },
            'ecosys m3655': { driver: 'everywhere', search: ['M3655', 'Kyocera', 'ECOSYS'] },
            'ecosys ma4000': { driver: 'everywhere', search: ['MA4000', 'Kyocera', 'ECOSYS'] },
            'taskalfa': { driver: 'Postscript-Kyocera', search: ['TASKalfa', 'Kyocera'] },
        },
        pclSupport: true,
        postscriptSupport: true,
        ippEverywhereSupport: true, // Kyocera has excellent IPP support
    },

    // =====================
    // Epson Printers (Non-Thermal)
    // =====================
    epson: {
        name: 'Epson',
        aliases: ['seiko epson'],
        preferredDrivers: ['epson-escpr', 'gutenprint', 'Postscript-Epson'],
        fallbackDrivers: ['epsonc', 'eplaser'],
        genericDriver: 'epson-escpr',
        models: {
            'workforce': { driver: 'epson-escpr', search: ['WorkForce', 'epson-escpr'] },
            'ecotank': { driver: 'epson-escpr', search: ['EcoTank', 'epson-escpr'] },
            'expression': { driver: 'epson-escpr', search: ['Expression', 'epson-escpr'] },
            'stylus': { driver: 'gutenprint', search: ['Stylus', 'gutenprint', 'epson'] },
            'aculaser': { driver: 'eplaser', search: ['AcuLaser', 'eplaser'] },
        },
        pclSupport: false,
        postscriptSupport: true,
    },

    // =====================
    // Canon Printers
    // =====================
    canon: {
        name: 'Canon',
        aliases: [],
        preferredDrivers: ['Postscript-Canon', 'gutenprint'],
        fallbackDrivers: ['bjc600', 'bjc800'],
        genericDriver: 'everywhere',
        models: {
            'imageclass': { driver: 'everywhere', search: ['imageCLASS', 'Canon'] },
            'imagerunner': { driver: 'Postscript-Canon', search: ['imageRUNNER', 'Canon'] },
            'pixma': { driver: 'gutenprint', search: ['PIXMA', 'Canon', 'gutenprint'] },
            'maxify': { driver: 'gutenprint', search: ['MAXIFY', 'Canon'] },
            'lbp': { driver: 'everywhere', search: ['LBP', 'Canon'] },
        },
        pclSupport: false,
        postscriptSupport: true,
        ippEverywhereSupport: true,
    },

    // =====================
    // Brother Printers
    // =====================
    brother: {
        name: 'Brother',
        aliases: [],
        preferredDrivers: ['Postscript-Brother', 'brlaser', 'hl1250', 'hl7x0'],
        fallbackDrivers: ['ljet4', 'pxlmono'],
        genericDriver: 'brlaser',
        models: {
            'hl-': { driver: 'brlaser', search: ['HL-', 'Brother', 'brlaser'] },
            'mfc-': { driver: 'Postscript-Brother', search: ['MFC-', 'Brother'] },
            'dcp-': { driver: 'brlaser', search: ['DCP-', 'Brother', 'brlaser'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // Xerox Printers
    // =====================
    xerox: {
        name: 'Xerox',
        aliases: ['fuji xerox'],
        preferredDrivers: ['Postscript-Xerox', 'gutenprint'],
        fallbackDrivers: ['pxlmono', 'pxlcolor', 'ljet4'],
        genericDriver: 'everywhere',
        models: {
            'phaser': { driver: 'Postscript-Xerox', search: ['Phaser', 'Xerox'] },
            'workcentre': { driver: 'Postscript-Xerox', search: ['WorkCentre', 'Xerox'] },
            'versalink': { driver: 'everywhere', search: ['VersaLink', 'Xerox'] },
            'altalink': { driver: 'everywhere', search: ['AltaLink', 'Xerox'] },
        },
        pclSupport: true,
        postscriptSupport: true,
        ippEverywhereSupport: true,
    },

    // =====================
    // Ricoh Printers
    // =====================
    ricoh: {
        name: 'Ricoh',
        aliases: ['gestetner', 'lanier', 'savin', 'nrg', 'infotec'],
        preferredDrivers: ['Postscript-Ricoh', 'PDF-Ricoh', 'pxlmono-Ricoh'],
        fallbackDrivers: ['pxlmono', 'pxlcolor'],
        genericDriver: 'everywhere',
        models: {
            'aficio': { driver: 'Postscript-Ricoh', search: ['Aficio', 'Ricoh'] },
            'sp ': { driver: 'pxlmono-Ricoh', search: ['SP ', 'Ricoh'] },
            'mp ': { driver: 'Postscript-Ricoh', search: ['MP ', 'Ricoh'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // Samsung Printers
    // =====================
    samsung: {
        name: 'Samsung',
        aliases: ['hp samsung'], // HP acquired Samsung printing
        preferredDrivers: ['splix', 'Postscript-Samsung', 'pxlmono-Samsung'],
        fallbackDrivers: ['pxlmono', 'ljet4'],
        genericDriver: 'splix',
        models: {
            'ml-': { driver: 'splix', search: ['ML-', 'Samsung', 'splix'] },
            'clp-': { driver: 'splix', search: ['CLP-', 'Samsung', 'splix'] },
            'scx-': { driver: 'splix', search: ['SCX-', 'Samsung'] },
            'xpress': { driver: 'Postscript-Samsung', search: ['Xpress', 'Samsung'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // Lexmark Printers
    // =====================
    lexmark: {
        name: 'Lexmark',
        aliases: [],
        preferredDrivers: ['Postscript-Lexmark', 'gutenprint'],
        fallbackDrivers: ['pxlmono', 'ljet4'],
        genericDriver: 'everywhere',
        models: {
            'ms': { driver: 'Postscript-Lexmark', search: ['MS', 'Lexmark'] },
            'mx': { driver: 'Postscript-Lexmark', search: ['MX', 'Lexmark'] },
            'cx': { driver: 'Postscript-Lexmark', search: ['CX', 'Lexmark'] },
            'cs': { driver: 'Postscript-Lexmark', search: ['CS', 'Lexmark'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // Konica Minolta
    // =====================
    konica: {
        name: 'Konica Minolta',
        aliases: ['konica minolta', 'minolta'],
        preferredDrivers: ['Postscript-KONICA_MINOLTA', 'rastertokmXXXXdl'],
        fallbackDrivers: ['pxlmono', 'pxlcolor'],
        genericDriver: 'everywhere',
        models: {
            'bizhub': { driver: 'Postscript-KONICA_MINOLTA', search: ['bizhub', 'Konica'] },
            'magicolor': { driver: 'rastertokmXXXXdl', search: ['magicolor', 'Konica'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // OKI Printers
    // =====================
    oki: {
        name: 'OKI',
        aliases: ['okidata'],
        preferredDrivers: ['Postscript-Oki', 'oki4drv'],
        fallbackDrivers: ['pxlmono', 'ljet4'],
        genericDriver: 'everywhere',
        models: {
            'c': { driver: 'Postscript-Oki', search: ['OKI C', 'Oki'] },
            'b': { driver: 'Postscript-Oki', search: ['OKI B', 'Oki'] },
            'mc': { driver: 'Postscript-Oki', search: ['MC', 'Oki'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // Sharp Printers
    // =====================
    sharp: {
        name: 'Sharp',
        aliases: [],
        preferredDrivers: ['Postscript-Sharp'],
        fallbackDrivers: ['pxlmono', 'pxlcolor'],
        genericDriver: 'everywhere',
        models: {
            'mx-': { driver: 'Postscript-Sharp', search: ['MX-', 'Sharp'] },
            'ar-': { driver: 'Postscript-Sharp', search: ['AR-', 'Sharp'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },

    // =====================
    // Toshiba Printers
    // =====================
    toshiba: {
        name: 'Toshiba',
        aliases: ['toshiba tec'],
        preferredDrivers: ['Postscript-Toshiba'],
        fallbackDrivers: ['pxlmono'],
        genericDriver: 'everywhere',
        models: {
            'e-studio': { driver: 'Postscript-Toshiba', search: ['e-STUDIO', 'Toshiba'] },
        },
        pclSupport: true,
        postscriptSupport: true,
    },
};

/**
 * Thermal/POS Printer Database
 * These use raw queue - no driver needed (ESC/POS protocol)
 */
const THERMAL_DATABASE = {
    epson: {
        name: 'Epson',
        models: ['TM-T20', 'TM-T88', 'TM-U220', 'TM-T82', 'TM-M30', 'TM-P80', 'TM-T70'],
        protocol: 'escpos',
        driver: 'raw',
    },
    star: {
        name: 'Star Micronics',
        models: ['TSP100', 'TSP143', 'TSP650', 'TSP700', 'TSP800', 'mPOP', 'SM-L200', 'SP700'],
        protocol: 'starline',
        driver: 'raw',
    },
    munbyn: {
        name: 'Munbyn',
        models: ['ITPP047', 'ITPP941', 'ITPP068', 'POS-80', 'ITPP080'],
        protocol: 'escpos',
        driver: 'raw',
    },
    snbc: {
        name: 'SNBC',
        models: ['BTP-R880NP', 'BTP-R580', 'BTP-M300', 'BTP-2002NP'],
        protocol: 'escpos',
        driver: 'raw',
    },
    posbank: {
        name: 'POS Bank',
        models: ['A7', 'A10', 'A11', 'APEXA-G'],
        protocol: 'escpos',
        driver: 'raw',
    },
    bematech: {
        name: 'Bematech',
        models: ['MP-4200', 'MP-100S', 'LR2000', 'MP-2800'],
        protocol: 'escpos',
        driver: 'raw',
    },
    citizen: {
        name: 'Citizen',
        models: ['CT-S310', 'CT-S601', 'CT-S651', 'CT-S801', 'CT-S851'],
        protocol: 'escpos',
        driver: 'raw',
    },
    custom: {
        name: 'Custom',
        models: ['TG2480', 'KUBE', 'Q3X', 'TL60', 'TL80'],
        protocol: 'escpos',
        driver: 'raw',
    },
    rongta: {
        name: 'Rongta',
        models: ['RP80', 'RP326', 'RP400', 'RP58', 'RP325'],
        protocol: 'escpos',
        driver: 'raw',
    },
    xprinter: {
        name: 'Xprinter',
        models: ['XP-58', 'XP-80', 'XP-Q200', 'XP-N160', 'XP-370B'],
        protocol: 'escpos',
        driver: 'raw',
    },
    sewoo: {
        name: 'Sewoo',
        models: ['SLK-TS400', 'LK-P20', 'LK-P30', 'LK-T21', 'SLK-TE212'],
        protocol: 'escpos',
        driver: 'raw',
    },
    zebra: {
        name: 'Zebra',
        models: ['ZD410', 'ZD420', 'ZD620', 'GK420', 'GC420'],
        protocol: 'zpl', // Zebra uses ZPL, not ESC/POS
        driver: 'raw',
    },
};

/**
 * Generic fallback drivers by printer type/protocol
 */
const GENERIC_DRIVERS = {
    // For IPP-capable printers
    ipp: {
        primary: 'everywhere',
        alternatives: [
            'driverless',
            'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd',
        ]
    },
    // For socket/JetDirect printers
    socket: {
        primary: 'everywhere',
        alternatives: [
            'ljet4',
            'pxlmono',
            'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd',
        ]
    },
    // For LPD printers
    lpd: {
        primary: 'ljet4',
        alternatives: [
            'pxlmono',
            'Postscript',
        ]
    },
    // For PostScript printers
    postscript: {
        primary: 'Postscript',
        alternatives: [
            'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd',
        ]
    },
    // For PCL printers
    pcl: {
        primary: 'ljet4',
        alternatives: [
            'ljet4d',
            'pxlmono',
            'hpijs-pcl5e',
        ]
    },
    // For thermal/receipt printers
    thermal: {
        primary: 'raw',
        alternatives: [
            'lsb/usr/cupsfilters/textonly.ppd',
        ]
    },
    // Ultimate fallback
    raw: {
        primary: 'raw',
        alternatives: []
    }
};

module.exports = {
    DRIVER_DATABASE,
    THERMAL_DATABASE,
    GENERIC_DRIVERS,
};
