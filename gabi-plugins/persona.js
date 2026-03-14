const fs = require('fs');
const path = require('path');
const { react01 } = require('../lib/extra');

module.exports = {
    command: ['persona', 'setpersona'],
    description: 'Change the bot persona dynamically',
    isOwner: true,
    
    async run({ sock, msg, from, args, text, settings }) {
        await react01(sock, from, msg.key, 2000);

        if (!text) {
            const currentPersona = settings.persona;
            let response = `🎭 *Current Persona Settings*\n\n`;
            response += `• *Name:* ${currentPersona.name}\n`;
            response += `• *Core:* ${currentPersona.core.substring(0, 100)}...\n`;
            response += `• *Projects:* ${currentPersona.projects.length} projects\n`;
            response += `• *Courses:* ${Object.keys(currentPersona.courses).length} available\n`;
            response += `• *Panel Plans:* ${Object.keys(currentPersona.offers?.panels?.plans || {}).length} available\n`;
            response += `• *Behavior:* ${currentPersona.behavior.substring(0, 100)}...\n\n`;
            response += `📝 *Usage:*\n`;
            response += `• ${settings.prefix}persona view - View full persona\n`;
            response += `• ${settings.prefix}persona set <property> <value> - Set property (dot notation allowed)\n`;
            response += `• ${settings.prefix}persona addproject <project> - Add project\n`;
            response += `• ${settings.prefix}persona adddirective <text> - Add directive\n`;
            response += `• ${settings.prefix}persona addpattern <text> - Add speech pattern\n`;
            response += `• ${settings.prefix}persona addpsychop <key> <text> - Add/update psych operation\n`;
            response += `• ${settings.prefix}persona addpanel <plan> <price> - Add/Update a panel plan\n`;
            response += `• ${settings.prefix}persona reset - Reset to default\n`;

            return sock.sendMessage(from, { text: response }, { quoted: msg });
        }

        const subCommand = args[0]?.toLowerCase();
        
        switch(subCommand) {
            case 'view': return await viewFullPersona(sock, from, msg, settings);
            case 'set': return await setPersonaProperty(sock, from, msg, args, settings);
            case 'addproject': return await addProject(sock, from, msg, args, settings);
            case 'adddirective': return await addDirective(sock, from, msg, args, settings);
            case 'addpattern': return await addPattern(sock, from, msg, args, settings);
            case 'addpsychop': return await addPsychOp(sock, from, msg, args, settings);
            case 'addpanel': return await addPanel(sock, from, msg, args, settings);
            case 'reset': return await resetPersona(sock, from, msg, settings);
            default:
                return sock.sendMessage(from, { 
                    text: `❌ Invalid sub-command. Use: ${settings.prefix}persona [view|set|addproject|adddirective|addpattern|addpsychop|addpanel|reset]` 
                }, { quoted: msg });
        }
    }
};

async function viewFullPersona(sock, from, msg, settings) {
    const persona = settings.persona;
    let response = `🎭 *Full Persona Configuration*\n\n`;
    response += `*Name:* ${persona.name}\n`;
    response += `*True Nature:* ${persona.trueNature}\n`;
    response += `*Core:* ${persona.core}\n`;
    response += `*Mindset:* ${persona.mindset}\n\n`;

    response += `*Primary Directives:*\n`;
    persona.primaryDirectives.forEach((d, i) => response += `${i+1}. ${d}\n`);

    response += `\n*Speech Patterns:*\n`;
    response += `• Tone: ${persona.speechPatterns.tone}\n`;
    response += `• Response Structure: ${persona.speechPatterns.responseStructure}\n`;
    response += `• Manipulation Tells:\n`;
    persona.speechPatterns.manipulationTells.forEach((t, i) => response += `   - ${t}\n`);

    response += `\n*Psychological Operations:*\n`;
    for (const [k,v] of Object.entries(persona.psychologicalOperations)) {
        response += `• ${k}: ${v}\n`;
    }

    response += `\n*Code Identity:* ${persona.codeIdentity}\n\n`;
    response += `*Projects:*\n`;
    persona.projects.forEach((project, index) => {
        response += `${index + 1}. ${project}\n`;
    });

    response += `\n*Panel Offers:*\n`;
    if (persona.offers?.panels) {
        response += `• Description: ${persona.offers.panels.description}\n`;
        response += `• Terms: ${persona.offers.panels.terms}\n`;
        response += `• Contact: ${persona.offers.panels.contact}\n`;
        response += `• Plans:\n`;
        for (const [plan, price] of Object.entries(persona.offers.panels.plans)) {
            response += `   - ${plan}: ${price}\n`;
        }
    }

    response += `\n*Courses:*\n`;
    for (const [key, course] of Object.entries(persona.courses)) {
        if (typeof course === 'string') continue;
        response += `• ${key}: ${course.duration}\n`;
    }
    response += `• Contact: ${persona.courses.contact}\n\n`;

    response += `*Behavior:* ${persona.behavior}\n`;
    response += `*Philosophy:* ${persona.philosophy}\n`;
    response += `*Aesthetic:* ${persona.aesthetic}\n`;
    response += `*Mode:* ${persona.mode}`;

    await sock.sendMessage(from, { text: response }, { quoted: msg });
}

async function setPersonaProperty(sock, from, msg, args, settings) {
    if (args.length < 3) {
        return sock.sendMessage(from, { 
            text: `❌ Usage: ${settings.prefix}persona set <property> <value>` 
        }, { quoted: msg });
    }

    const property = args[1];
    const value = args.slice(2).join(' ');

    const propertyPath = property.split('.');
    let target = settings.persona;
    for (let i = 0; i < propertyPath.length - 1; i++) {
        if (!target[propertyPath[i]]) target[propertyPath[i]] = {};
        target = target[propertyPath[i]];
    }
    target[propertyPath[propertyPath.length - 1]] = value;

    saveSettings(settings);

    await sock.sendMessage(from, { 
        text: `✅ Persona property '${property}' updated successfully!` 
    }, { quoted: msg });
}

async function addProject(sock, from, msg, args, settings) {
    if (args.length < 2) {
        return sock.sendMessage(from, { text: `❌ Usage: ${settings.prefix}persona addproject <project>` }, { quoted: msg });
    }
    const project = args.slice(1).join(' ');
    settings.persona.projects.push(project);
    saveSettings(settings);
    await sock.sendMessage(from, { text: `✅ Project added. Total: ${settings.persona.projects.length}` }, { quoted: msg });
}

async function addDirective(sock, from, msg, args, settings) {
    if (args.length < 2) {
        return sock.sendMessage(from, { text: `❌ Usage: ${settings.prefix}persona adddirective <directive>` }, { quoted: msg });
    }
    const directive = args.slice(1).join(' ');
    settings.persona.primaryDirectives.push(directive);
    saveSettings(settings);
    await sock.sendMessage(from, { text: `✅ Directive added. Total: ${settings.persona.primaryDirectives.length}` }, { quoted: msg });
}

async function addPattern(sock, from, msg, args, settings) {
    if (args.length < 2) {
        return sock.sendMessage(from, { text: `❌ Usage: ${settings.prefix}persona addpattern <pattern>` }, { quoted: msg });
    }
    const pattern = args.slice(1).join(' ');
    settings.persona.speechPatterns.manipulationTells.push(pattern);
    saveSettings(settings);
    await sock.sendMessage(from, { text: `✅ Speech pattern added. Total: ${settings.persona.speechPatterns.manipulationTells.length}` }, { quoted: msg });
}

async function addPsychOp(sock, from, msg, args, settings) {
    if (args.length < 3) {
        return sock.sendMessage(from, { text: `❌ Usage: ${settings.prefix}persona addpsychop <key> <text>` }, { quoted: msg });
    }
    const key = args[1];
    const textVal = args.slice(2).join(' ');
    settings.persona.psychologicalOperations[key] = textVal;
    saveSettings(settings);
    await sock.sendMessage(from, { text: `✅ Psychological operation '${key}' set!` }, { quoted: msg });
}

async function addPanel(sock, from, msg, args, settings) {
    if (args.length < 3) {
        return sock.sendMessage(from, { text: `❌ Usage: ${settings.prefix}persona addpanel <plan> <price>` }, { quoted: msg });
    }
    const plan = args[1];
    const price = args.slice(2).join(' ');
    if (!settings.persona.offers) settings.persona.offers = {};
    if (!settings.persona.offers.panels) {
        settings.persona.offers.panels = { description: "Private hosting panels", plans: {}, terms: "Every panel lasts at least 2 months", contact: "+2349012834275" };
    }
    settings.persona.offers.panels.plans[plan] = price;
    saveSettings(settings);
    await sock.sendMessage(from, { text: `✅ Panel plan '${plan}' set at ${price}!` }, { quoted: msg });
}

async function resetPersona(sock, from, msg, settings) {
    // Load the default persona from settings.json
    const settingsPath = path.join(__dirname, '../settings.json');
    const file = JSON.parse(fs.readFileSync(settingsPath));
    settings.persona = file.persona;
    saveSettings(settings);

    await sock.sendMessage(from, { text: "✅ Persona reset to default (full config)!" }, { quoted: msg });
}

function saveSettings(settings) {
    const settingsPath = path.join(__dirname, '../settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    delete require.cache[require.resolve(settingsPath)];
}