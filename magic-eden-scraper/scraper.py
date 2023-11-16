import logging
import subprocess
from time import sleep
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger()


def ensure_node_is_installed():
    logger.info('Checking to see if node is installed')
    try:
        node_version = subprocess.check_output(['node', '--version'])
        node_version = node_version.decode('utf-8')
        node_version = node_version.replace('v', '')
        node_version = node_version.split('.')
        if int(node_version[0]) < 12:
            logger.error('Node version 12 or above is required')
            exit(1)
    except FileNotFoundError:
        logger.error('Node is not installed')
        exit(1)
    logger.info('Node is installed. Proceeding')


def get_selenium_driver():
    logger.info("Setting up headless browser")
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-gpu')
    options.add_argument('disable-blink-features=AutomationControlled')
    options.add_argument("window-size=1920,1080")
    options.add_argument(f'user-agent={UserAgent().chrome}')

    try:
        driver = webdriver.Chrome(
            options=options, service=Service('chromedriver'))
        driver.implicitly_wait(15)
    except Exception as e:
        print(e)
        logger.error('Could not start headless browser')
        exit(1)

    return driver


def get_listed_nft_urls(driver):
    logger.info("Opening Magic Eden")
    driver.get('https://magiceden.io/marketplace/worthlesspixels')

    logger.info("Waiting for page to load")
    last_height = driver.execute_script('return document.body.scrollHeight;')
    while True:
        driver.execute_script(
            'window.scrollTo(0, document.body.scrollHeight);')
        sleep(5)

        new_height = driver.execute_script(
            'return document.body.scrollHeight;')
        if new_height == last_height:
            break

        last_height = new_height
        sleep(5)

    logger.info("Parsing page with BeautifulSoup")
    soup = BeautifulSoup(driver.page_source, 'html.parser')

    logger.info("Generating all listed NFT URLs")
    nft_urls = [nft_name.find_parent('a').get('href') for nft_name in soup.find_all(
        'h6', {'class': 'grid-card__title', 'title': True})]
    logger.info(f'Found {len(nft_urls)} NFTs')

    return nft_urls


def bot(nft_urls, driver):
    logger.info('Iterating through NFTs')
    for nft_url in nft_urls:
        logger.info(f'Opening {nft_url}')
        driver.get(f'https://magiceden.io{nft_url}')
        sleep(5)

        logger.info('Parsing page with BeautifulSoup')
        soup = BeautifulSoup(driver.page_source, 'html.parser')

        class_attr_container = soup.find_all(
            'div', {'class': 'attributes-column'})[1]
        class_attr_value = class_attr_container.select(
            '.attribute-value')[0].text

        if class_attr_value.strip() == 'nobot':
            continue

        logger.info('Listed NFT found with a class other than nobot')
        mint_address = nft_url.split('/')[2].split('?')[0]

        logger.info(
            'Downloading the meatadata by invoking the following command')
        logger.info(
            f'node ./metaplex-scripts/download-json-metadata {mint_address}')

        try:
            subprocess.run(
                ['node', 'download-json-metadata.js', mint_address], check=True, cwd='./metaplex-scripts')
            logger.info('Metadata downloaded')
        except subprocess.CalledProcessError:
            logger.error('Failed to download the metadata')
            continue

        logger.info(
            'Copying the image to mint-api.worthlesspixels.com over SCP')
        logger.info(
            f'scp ./metaplex-scripts/json-metadata/{mint_address}-nobot.json antematter@mint-api.worthlesspixels.com:/var/www/html/json')

        try:
            subprocess.run(['scp', '-o', 'StrictHostKeyChecking=no', f'./metaplex-scripts/json-metadata/{mint_address}-nobot.json',
                            'antematter@mint-api.worthlesspixels.com:/var/www/html/json'
                            ], check=True)
            logger.info('Metadata copied to the mint-api server')
        except subprocess.CalledProcessError:
            logger.error('Failed to copy the metadata to the mint-api server')
            continue

        logger.info('Updating the URI for the NFT to point to the new metadata')
        logger.info(
            f'node ./metaplex-scripts/update-json-metadata {mint_address}')

        try:
            subprocess.run(['node', 'update-json-metadata.js',
                           mint_address], check=True, cwd='./metaplex-scripts')
            logger.info('URI updated')
        except subprocess.CalledProcessError:
            logger.error('Failed to update the URI')
            continue


def main():
    ensure_node_is_installed()
    driver = get_selenium_driver()
    nft_urls = get_listed_nft_urls(driver)
    bot(nft_urls, driver)
    logger.info('Done')
    driver.quit()


if __name__ == '__main__':
    while True:
        main()

        logger.info('Restarting in 60 minutes')
        for i in range(60):
            sleep(60)
            logger.info(f'{60 - i} minutes remaining')
