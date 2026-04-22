import requests
import random

def get_joke():
    response = requests.get("https://official-joke-api.appspot.com/random_joke")
    if response.status_code == 200:
        joke = response.json()
        return f"{joke['setup']} - {joke['punchline']}"
    else:
        return "Sorry, I couldn't fetch a joke right now."

if __name__ == '__main__':
    print(get_joke())