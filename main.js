const Apify = require('apify')
const typeCheck = require('type-check').typeCheck
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')

// counter for max number of entries
var counter = 0
const ENTRIES_MAX = 3
const WORDS_MIN = 3
const PAGES_MAX = 2

// Definition of the input
const INPUT_TYPE = `{
    query: String
    source: String
    translation: String
}`

const LEVEL_TYPE = {
    NOVOICE: 'NOVOICE',
    INTERMEDIATE: 'INTERMEDIATE',
    EXPERT: 'EXPERT'
}

const getLanguage = language => {
    switch (language) {
        case 'french': return 'fra'
        case 'english': return 'eng'
        case 'russian': return 'rus'
        case 'spanish': return 'spa'
        case 'italian': return 'ita'
        case 'chinese': return 'cmn'
        case 'japanese': return 'jpn'
        case 'german': return 'deu'
        case 'korean': return 'kor'
        case 'latin': return 'lat'
        default: return ''
    }
}

const getWordCount = str => {
    return str.split(' ').length
}

const getPageContent = async (uri, browser, counter) => {
    // only limit to certain number of entries
    if (counter === ENTRIES_MAX) return definitions
    const page = await browser.newPage()
    await page.goto(uri, {
        timeout: 200000,
    })
    let html = await page.content()
    let $ = cheerio.load(html)

    // get entries
    let definitions = []
    $('.sentence-and-translations').each((i, elem) => {
        // only limit to certain number of entries
        if (counter === ENTRIES_MAX) return definitions
        const phrase_mono = $(elem).find('.sentence.layout-row').eq(0).find('.text.flex').text().trim()
        // TODO: remove other puntuation marks like ? ! with regex
        const phrase_mono_puntuation_removed = phrase_mono.replace('!', '').trim()
        // capture phrases with words greater than defined number
        if (getWordCount(phrase_mono_puntuation_removed) >= WORDS_MIN) {
            const phrase_tran = $(elem).find('.translation.layout-row').eq(0).find('.text.flex').text().trim()
            definitions.push({
                meaning: phrase_tran,
                grammar: '',
                examples: [{
                    level: LEVEL_TYPE.NOVOICE,
                    phrase_mono,
                    phrase_tran
                }]
            })
            counter = counter + 1
        }
    })
    await page.close()
    return definitions
}

Apify.main(async () => {
    // Fetch the input and check it has a valid format
    // You don't need to check the input, but it's a good practice.
    const input = await Apify.getValue('INPUT')
    if (!typeCheck(INPUT_TYPE, input)) {
        console.log('Expected input:')
        console.log(INPUT_TYPE)
        console.log('Received input:')
        console.dir(input)
        throw new Error('Received invalid input')
    }

    // Here's the place for your magic...
    console.log(`Input query: ${input.query}`)

    // Environment variables
    const launchPuppeteer = process.env.NODE_ENV === 'development' ? puppeteer.launch : Apify.launchPuppeteer
    const browser = await launchPuppeteer()

    // Navigate to each Tatoeba.org page
    let definitions = []
    for (i = 0; i < PAGES_MAX; i++) {
        const uri = `https://tatoeba.org/${getLanguage(input.translation)}/sentences/search/page:${i + 1}?query=${input.query}&from=${getLanguage(input.source)}&to=${getLanguage(input.translation)}&orphans=no&unapproved=no&native=yes&user=&tags=&list=&has_audio=&trans_filter=limit&trans_to=${getLanguage(input.translation)}&trans_link=&trans_user=&trans_orphan=&trans_unapproved=&trans_has_audio=&sort=words`
        console.log(uri)
        // Limit to max number of entries
        const response = counter < ENTRIES_MAX ? await getPageContent(uri, browser, counter) : []
        definitions = definitions.concat(response)
    }

    // Store the output
    const output = {
        crawledAt: new Date(),
        name: 'apify/igsys/phrase-tatoeba',
        input,
        definitions
    }
    console.log('output:')
    console.dir(output)
    await Apify.setValue('OUTPUT', output)
})
